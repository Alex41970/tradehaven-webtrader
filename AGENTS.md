# Architecture rules

- Resolve application imports of the managed database client through `src/lib/trading-client.ts`, retaining one managed client and session while the existing trading schema is migrated; never modify generated connection files to suppress schema errors.
- Keep the pre-Cloud trading schema contract in `src/lib/trading-database.types.ts` until the target Cloud schema is migrated and verified; this contract is not proof that tables or account data exist in Cloud.