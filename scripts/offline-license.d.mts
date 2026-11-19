import type { Plugin } from 'vite';

export function normalizeDomain(input: string | undefined): string;
export function validateBuyerConnection(url: string | undefined, key: string | undefined, sellerUrl?: string): { url: string; key: string };
export function gateSource(domain: string, modulePath?: string): string;
export function obfuscateRelease(code: string): string;
export function offlineLicensePlugin(domain: string): Plugin;