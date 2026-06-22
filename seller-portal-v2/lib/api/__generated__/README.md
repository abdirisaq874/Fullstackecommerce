# OpenAPI-Generated Types

This directory holds **OpenAPI-generated TypeScript types** for the seller portal's
backend API contracts. The types are produced by
[`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript) from the
NestJS backend's Swagger document.

## Contents

- `types.ts` — generated `paths`, `components`, and `operations` types. **Do not
  edit by hand.** It is overwritten on every codegen run.
- `openapi.snapshot.json` *(optional)* — a checked-in snapshot of the backend's
  OpenAPI document, used by the offline codegen script when the backend isn't
  reachable. Currently not committed; add one with
  `curl http://localhost:3000/docs-json > lib/api/__generated__/openapi.snapshot.json`
  if you need offline regeneration.

## How to regenerate

The backend must be running locally on `http://localhost:3000`:

```bash
# Terminal 1 — start the backend
cd ecommerce-backend && npm run start:dev

# Terminal 2 — regenerate types
cd seller-portal-v2 && npm run codegen:api
```

If the backend isn't reachable but you have a snapshot committed, use the offline
script:

```bash
cd seller-portal-v2 && npm run codegen:api:offline
```

The generated `types.ts` should be committed to source control. Reviewers can
then see API surface changes in PR diffs.

## When to regenerate

Regenerate every time the backend API surface changes, including:

- New endpoints or HTTP methods
- Renamed routes / changed path parameters
- DTO additions, renames, or field-type changes
- Response shape changes
- Auth requirement changes on existing endpoints

If you change a DTO on the backend but forget to regenerate, the frontend's
typed clients will silently drift from reality.

## CI enforcement (future)

A future enhancement will add a CI check that:

1. Boots the backend (or uses the snapshot)
2. Re-runs `npm run codegen:api`
3. Fails the build if `git diff --exit-code lib/api/__generated__/types.ts`
   shows a non-empty diff

This will catch PRs that change the API without updating the generated types.

## Consumption

Generated types are **not** yet consumed by `base-api.ts` — phase 3 of the
seller-portal-v2 plan wires them into the typed API client. For now this
directory exists so that codegen is part of the foundation and the path is
stable.
