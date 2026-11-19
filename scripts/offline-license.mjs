import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

export function normalizeDomain(input) {
  if (typeof input !== 'string' || input !== input.trim() || /[/:@*?#\\\s]/.test(input)) {
    throw new Error('Provide one exact hostname, without a scheme, path, port or wildcard.');
  }
  const domain = domainToASCII(input).toLowerCase();
  if (domain.length > 253 || !domain.includes('.') || isIP(domain) ||
      !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Provide a valid public hostname. Localhost and IP addresses are not release domains.');
  }
  return domain;
}

export function validateBuyerConnection(url, key, sellerUrl) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('BUYER_BACKEND_URL must be an HTTPS origin.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('BUYER_BACKEND_URL must be an HTTPS origin.');
  }
  if (sellerUrl && parsed.origin === new URL(sellerUrl).origin) {
    throw new Error('Buyer releases cannot use the current project connection.');
  }
  // Only public browser credentials are allowed here; never accept a service-role JWT.
  let validKey = typeof key === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (typeof key === 'string' && key.split('.').length === 3) {
    try {
      validKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
    } catch { validKey = false; }
  }
  if (!validKey) throw new Error('BUYER_PUBLISHABLE_KEY must be a public browser key, never a private key.');
  return { url: parsed.origin, key };
}

// No network calls, timers, account access or destructive behavior in the gate.
export function gateSource(domain, modulePath = '/src/main.tsx') {
  const hostname = normalizeDomain(domain);
  return `if (window.location.protocol === 'https:' && window.location.hostname.toLowerCase() === ${JSON.stringify(hostname)}) {
    import(${JSON.stringify(modulePath)});
  } else {
    const message = document.createElement('p');
    message.textContent = 'This installation is not licensed for this address.';
    document.body.replaceChildren(message);
  }`;
}

export function obfuscateRelease(code) {
  return JavaScriptObfuscator.obfuscate(code, {
    target: 'browser', compact: true, sourceMap: false,
    stringArray: true, stringArrayThreshold: 0.75,
    stringArrayEncoding: ['base64'], identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false, controlFlowFlattening: false,
    deadCodeInjection: false, debugProtection: false, selfDefending: false,
  }).getObfuscatedCode();
}

export function offlineLicensePlugin(domain) {
  const hostname = normalizeDomain(domain);
  const virtualId = 'virtual:offline-licensed-entry';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'offline-buyer-license',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Release-only HTML cleanup; do not change the running project's branding.
        return html.replace('/src/main.tsx', '/' + virtualId)
          .replace(/<meta\b[^>]*(?:name=["'](?:author|twitter:site|twitter:image)["']|property=["']og:image["'])[^>]*>/gi, '')
          .replace(/<link\b[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, '');
      },
    },
    resolveId(id) { if (id === virtualId || id === '/' + virtualId) return resolvedId; },
    load(id) { if (id === resolvedId) return gateSource(hostname); },
    generateBundle(_options, bundle) {
      for (const [filename, entry] of Object.entries(bundle)) {
        if (filename.endsWith('.map')) throw new Error('Source maps are forbidden in buyer releases.');
        if (entry.type === 'chunk') entry.code = obfuscateRelease(entry.code);
      }
    },
  };
}