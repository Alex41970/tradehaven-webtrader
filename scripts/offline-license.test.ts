import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { gateSource, normalizeDomain, obfuscateRelease, offlineLicensePlugin, validateBuyerConnection } from './offline-license.mjs';

function runGate(hostname: string, protocol = 'https:', obfuscated = false) {
  const imports: string[] = [];
  let blocked = false;
  const source = gateSource('portal.buyer.example').replace('import(', 'startApp(');
  vm.runInNewContext(obfuscated ? obfuscateRelease(source) : source, {
    window: { location: { hostname, protocol } },
    startApp: (path: string) => imports.push(path),
    document: {
      createElement: () => ({ textContent: '' }),
      body: { replaceChildren: () => { blocked = true; } },
    },
  }, { timeout: 2000 });
  return { imports, blocked };
}

describe('offline buyer release', () => {
  it('allows only the exact licensed domain over HTTPS', () => {
    expect(runGate('portal.buyer.example')).toEqual({ imports: ['/src/main.tsx'], blocked: false });
    for (const hostname of ['copy.example', 'portal.buyer.example.evil.example', 'www.portal.buyer.example', 'localhost', '']) {
      expect(runGate(hostname)).toEqual({ imports: [], blocked: true });
    }
    expect(runGate('portal.buyer.example', 'http:')).toEqual({ imports: [], blocked: true });
  });

  it('does not require networking for the allowed or rejected case after obfuscation', () => {
    // The sandbox deliberately provides no fetch, WebSocket, navigator or timers.
    expect(runGate('portal.buyer.example', 'https:', true).imports).toEqual(['/src/main.tsx']);
    expect(runGate('copy.example', 'https:', true)).toEqual({ imports: [], blocked: true });
  });

  it('rejects URLs, wildcard and development host licenses', () => {
    for (const value of ['https://buyer.example', '*.buyer.example', 'localhost', '127.0.0.1', 'buyer.example:443', 'buyer.example/path', 'buyer.example.', 'buyer.example\n']) {
      expect(() => normalizeDomain(value)).toThrow();
    }
    expect(normalizeDomain('Portal.Buyer.Example')).toBe('portal.buyer.example');
  });

  it('refuses the seller connection and private credentials', () => {
    expect(() => validateBuyerConnection('https://seller.example', 'sb_publishable_test', 'https://seller.example')).toThrow();
    expect(() => validateBuyerConnection('https://buyer.example', 'sb_secret_private', 'https://seller.example')).toThrow();
    const privateJwt = `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
    expect(() => validateBuyerConnection('https://buyer.example', privateJwt)).toThrow();
    expect(validateBuyerConnection('https://buyer.example', 'sb_publishable_test', 'https://seller.example').url).toBe('https://buyer.example');
  });

  it('gates the entry before application imports and rejects source maps', () => {
    const plugin = offlineLicensePlugin('portal.buyer.example');
    const html = plugin.transformIndexHtml.handler('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('/virtual:offline-licensed-entry');
    const id = plugin.resolveId('/virtual:offline-licensed-entry');
    expect(plugin.load(id)).toContain('import("/src/main.tsx")');
    expect(() => plugin.generateBundle({}, { 'app.js.map': { type: 'asset' } })).toThrow();
  });
});