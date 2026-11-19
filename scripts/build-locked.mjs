import { build, loadEnv } from 'vite';
import { normalizeDomain, validateBuyerConnection } from './offline-license.mjs';

try {
  const args = process.argv.slice(2);
  const domainArg = args.find(arg => arg.startsWith('--domain='));
  if (args.length !== 1 || !domainArg) throw new Error('Usage: bun run build:locked --domain=portal.buyer.example');
  const domain = normalizeDomain(domainArg.slice('--domain='.length));
  const existing = loadEnv('production', process.cwd(), 'VITE_SUPABASE');
  validateBuyerConnection(process.env.BUYER_BACKEND_URL, process.env.BUYER_PUBLISHABLE_KEY, existing.VITE_SUPABASE_URL);
  process.env.OFFLINE_RELEASE_DOMAIN = domain;
  await build({ mode: 'locked' });
  console.log(`Offline protected files: dist/locked/${domain}`);
  console.log('Not a completed handover: provision buyer-owned services and review branding, legal claims and third-party links before delivery.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release failed.');
  process.exitCode = 1;
}