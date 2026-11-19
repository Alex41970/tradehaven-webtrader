# Offline protected buyer releases

## What this provides

An opt-in release for one exact HTTPS hostname. The browser checks its hostname
before importing the trading application. A mismatch shows a plain licensing
message; it does not freeze the browser, delete data or interfere with trading
accounts. All generated JavaScript chunks are obfuscated and source maps are
disabled. There is no license server, callback, telemetry or remote revocation
added by this protection. Normal builds and the live preview are unchanged.

This is a copying deterrent, not an unbreakable security boundary. A person who
controls the delivered JavaScript can modify the check. Giving original source
code makes removing it easier. Domain locks do not prevent a buyer reselling
access to their licensed domain. Do not describe this as air-gapped: the trading
application still needs the buyer's online services.

## Prepare a release

1. Obtain the buyer's exact hostname. Apex and `www` are different licenses;
   wildcards, HTTP, localhost and IP addresses are not allowed.
2. Provision a separate buyer-owned backend with this application's schema,
   functions, schedules and auth setup. A static website folder alone cannot
   run the trading platform. Do not copy existing users or financial data.
3. In the release terminal set `BUYER_BACKEND_URL` and
   `BUYER_PUBLISHABLE_KEY` to the buyer's HTTPS backend origin and public browser
   key. Never supply a private or service-role key. Do not commit credentials.
4. Run `bun run build:locked --domain=portal.buyer.example`.
5. Output is `dist/locked/portal.buyer.example/`. Deploy only its contents,
   not the source repository, `.env`, `.git`, migrations or project tooling.
   Configure HTTPS and the host's SPA fallback to `index.html`.
6. Test on the exact licensed domain with a buyer test account: sign-in,
   prices, chart history, open/close trades, balance settlement and admin access.
   Also test an unlicensed hostname and confirm the app does not start.

The release refuses the current project's backend origin. This prevents accidental
reuse, but cannot prove the buyer legally owns a replacement service or detect
every seller-owned service embedded elsewhere.

## Required handover review — not automated by this prototype

- Replace branding, author details, contact information, favicon and social
  images with buyer-approved assets. Release HTML omits author/social account
  tags, existing social preview images and external font links; it does not
  rebrand the rest of the application.
- Review existing regulatory claims, the FCA link and Trustpilot link in the
  footer. Do not represent these as verified or transfer another firm's claims.
- Audit all remaining external links, embedded media and network requests.
  Existing third-party payment icons and other external content are not removed.
- Buyer supplies and pays for hosting, domain, market-data credentials, mail,
  calling services and any other integrations; reconfigure and test each one.
- Transfer no seller account access; remove seller access after agreed acceptance,
  rotate buyer credentials and document who runs every service.
- Preserve third-party copyright and license notices required by dependencies.
  Obfuscation does not override their terms or market-data redistribution rights.
- Use a lawyer-reviewed non-transferable, non-sublicensable software license with
  explicit no-resale terms if you retain ownership. A full copyright assignment
  or unrestricted source transfer can conflict with that goal.

Copyright often arises automatically; registration rules and enforcement vary
by jurisdiction. No technical packaging or “as-is” clause guarantees anonymity,
erases records of a sale, or eliminates legal/regulatory responsibility. Obtain
qualified legal advice for this financial-software sale.

## Validation

Run `bun run test:license`. Tests cover exact-host enforcement, HTTPS, invalid
hostnames, no networking in the license check, private-key rejection, seller
connection rejection and source-map refusal. Test the completed buyer deployment
separately; these checks do not certify a completed operational handover.