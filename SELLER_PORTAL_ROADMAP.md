# Seller Portal v2 — Path to End-to-End

Audit + daily plan for finishing `seller-portal-v2/` as a production seller portal connected to the NestJS backend.

---

## Where it stands

Structurally ~70% complete as a scaffold. Routing, design system, component organization, types, and most feature surfaces are in place. Three load-bearing layers are entirely missing:

1. **Auth** — no login, no register, no token, no middleware. App drops straight into the dashboard with hardcoded user "Aysel".
2. **Real backend** — every API slice uses `fakeBaseQuery` + `mock-db.ts` (~470 lines of seed data).
3. **Several pages are stubs** — settings cards are non-clickable; marketing, shipping, customers, finance are read-only views over mock data.

**Backend dependency:** most seller-scoped endpoints don't exist yet in the NestJS API. The portal cannot be end-to-end until both sides ship together. See `ROADMAP.md` D14, D64–D69 for the backend half.

---

## v2 strengths to preserve

Do NOT regress on these when porting from v1.

| Strength | Where | Why it matters |
|---|---|---|
| Route group `app/(portal)/` | layout structure | clean separation from future public/auth/marketing routes |
| Command palette (Cmd+K) | `components/layout/command-palette.tsx` | killer power-user feature v1 lacks entirely |
| ErrorState + EmptyState + Skeleton on every page | `components/data/` | every list/detail handles loading/error/empty gracefully |
| Print stylesheets | `(portal)` layout + packing slip | fulfillment workflow ready |
| Custom design system (forest-green palette, DM Sans + Instrument Serif) | `tailwind.config.ts` | brand identity feels intentional |
| Returns/RMA full state machine | `app/(portal)/returns/` | not present in v1 at all |
| Multi-language product fields (EN/TR/SO/SW/AM) | `components/product/product-form.tsx` | cross-border ready |
| Strict TypeScript (`strict: true`) | `tsconfig.json` | v1 is `strict: false` — v2 wins here |
| Fulfillment wizard with customs declaration | `orders/[id]/fulfill` | beyond what v1 has |
| Lucide icons consistently | throughout | professional iconography |

---

## What v1 has that v2 must absorb

| # | Port | Where in v1 | What to lift |
|---|---|---|---|
| P1 | Real RTK Query base | `frontend/src/store/api/apiSlice.ts` | `fetchBaseQuery` + `prepareHeaders` (bearer) + 401-auto-refresh + envelope unwrap |
| P2 | Auth slice + token persistence | `frontend/src/store/slices/authSlice.ts` | login/logout actions, localStorage sync, hydration |
| P3 | Auth pages | `frontend/src/app/auth/login/page.tsx`, `register/page.tsx` | full forms wired to authApi |
| P4 | React Hook Form + Zod | RHF + zod + @hookform/resolvers in v1 deps | replace v2's plain `useState` + manual error map |
| P5 | Role-based nav filtering | `frontend/src/components/layout/DashboardLayout.tsx` | `nav.filter(item => item.roles.includes(role))` |
| P6 | RTK Query polling | DashboardLayout (30s / 60s) | live notification badge + dashboard stats |
| P7 | Recharts | v1 deps | swap v2's custom dashboard widgets for real charts |

---

## Pages that are stubs (v2 needs to finish these)

- `/settings` — 7 section cards, all non-clickable. Need sub-pages: store profile, payouts, tax, team, shipping defaults, notifications, security.
- `/customers` — reads `db.customers` directly, no API slice, no filters/search/segments.
- `/marketing` — hardcoded promotions, "New promotion" button dead, no coupon editor.
- `/shipping` — zones from mock data, "Add zone" unhooked, no rate editor.
- `/finance` — only `/finance/reports` exists; no payouts/balance/fees view.

## Missing API slices to create

- `auth-api.ts` (login, register, refresh, logout, me)
- `customers-api.ts`
- `coupons-api.ts` (marketing)
- `shipping-api.ts`
- `finance-api.ts` (payouts, transactions, balances)
- `uploads-api.ts` (signed URL for product images)

## Backend dependencies (build on the NestJS side — see backend ROADMAP.md D14, D64–D69)

- `GET /seller/products` (scoped to sellerId)
- `GET /seller/orders` (orders containing seller's items, projected)
- `GET /seller/returns`, `POST /seller/returns/:id/transition`
- `GET /seller/messages`, threads + reply
- `GET /seller/dashboard/metrics`, `winning`, `sliding`
- `GET /seller/customers`
- `GET /seller/finance/payouts`, `transactions`, `balance`
- `POST /uploads/signed-url`
- `GET /search?type=product|order|message&q=` (for command palette)

---

## Daily Todo (5 weeks ≈ 35 days)

### Week 1 — Auth & real API foundation (port from v1)

- [ ] **S1.** Install `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner` (optional), `recharts` in seller-portal-v2.
- [ ] **S2.** Create `lib/api/auth-slice.ts` (port from v1's authSlice). Hydrate from `localStorage` on mount.
- [ ] **S3.** Replace `lib/api/base-api.ts` `fakeBaseQuery` with `fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_URL })` + `prepareHeaders` injecting bearer + envelope unwrap.
- [ ] **S4.** Add the 401-auto-refresh `baseQueryWithReauth` wrapper from v1's apiSlice. Wire `authApi.refresh` mutation.
- [ ] **S5.** Create `lib/api/auth-api.ts` — login, register, refresh, logout, getMe endpoints.
- [ ] **S6.** Create `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx` with RHF + Zod. Forest-green branded forms matching v2's design system.
- [ ] **S7.** Create `middleware.ts` at the root — redirect unauthenticated requests on `(portal)/*` to `/login`. Read token from cookie or via a server-readable mechanism (or do client-side guard inside `(portal)/layout.tsx` if you keep token in localStorage).

### Week 2 — Wire existing portal to auth + UX leveling

- [ ] **S8.** `(portal)/layout.tsx` — read auth state; redirect to `/login` if none. Replace hardcoded "Aysel" with `user.firstName` from store.
- [ ] **S9.** Topbar profile menu — add real avatar/name, logout button, link to `/settings`.
- [ ] **S10.** Add `useGetMeQuery` polling so token expiry/role changes are picked up live. Add `useGetUnreadCountQuery({ pollingInterval: 30000 })` for notifications.
- [ ] **S11.** Refactor `components/product/product-form.tsx` to React Hook Form + Zod schema in `lib/schemas/product.ts`. Keep the tabbed layout — RHF works with tabs via `trigger(fieldNames)`.
- [ ] **S12.** Same RHF+Zod migration for inventory adjust form, return decision form, message reply.
- [ ] **S13.** Role-based nav: add `roles` field to nav items in `components/layout/sidebar.tsx`; filter by `user.role`. Hide /admin sections from sellers.
- [ ] **S14.** Forgot-password page + flow wired to backend `/auth/forgot-password` + `/auth/reset-password`.

### Week 3 — Finish stubbed pages (still on mocks where backend missing)

- [ ] **S15.** Settings landing → real sub-pages. Build `/settings/store-profile` form (name, logo, currency, region).
- [ ] **S16.** `/settings/payouts` — Stripe Connect onboarding link (backend D64), bank info display.
- [ ] **S17.** `/settings/team` — invite teammate by email, role assignment UI (mock for now if backend RBAC isn't ready).
- [ ] **S18.** `/settings/notifications` — checkbox grid for which events email/in-app/SMS.
- [ ] **S19.** `/settings/security` — change password, sessions list, 2FA toggle stub.
- [ ] **S20.** `/customers` — create `customers-api.ts` + page with filters (segment, lifetime value, last-order date), search, detail drawer.
- [ ] **S21.** `/marketing` — create `coupons-api.ts`, build coupon CRUD modal (code, type, value, scope, dates, limits), list with active/expired/scheduled tabs.
- [ ] **S22.** `/shipping` — zone CRUD modal, rate-per-method editor, customs-declaration template editor.
- [ ] **S23.** `/finance` overview — pending balance, next payout date, recent transactions, fee breakdown. Lives alongside the existing `/finance/reports`.
- [ ] **S24.** Onboarding wizard for first login — guided 4-step (profile → payouts → shipping → first product).

### Week 4 — Real backend wiring (depends on backend roadmap D14, D64–D69 shipping)

- [ ] **S25.** Swap mock `queryFn` → real `query` in `products-api.ts` endpoints. Test against `/seller/products`.
- [ ] **S26.** Swap mock → real in `orders-api.ts`. Wire fulfill flow to backend.
- [ ] **S27.** Swap mock → real in inventory, returns, messages, dashboard APIs.
- [ ] **S28.** Real image upload — create `uploads-api.ts`, fetch signed URL, PUT to CDN, save URL in product. Replace `URL.createObjectURL` blobs.
- [ ] **S29.** CSV import — wire to backend bulk-create endpoint (or to upload + async job).
- [ ] **S30.** Delete `lib/api/mock-db.ts`. Add a `lib/api/__fixtures__/` folder for testing if needed.
- [ ] **S31.** Command palette — wire to `/search` backend endpoint with debounced query (300ms).

### Week 5 — Real-time, polish, quality

- [ ] **S32.** WebSocket (or SSE) for live notifications, new orders, new messages. Topbar badge updates without polling. Falls back to 30s polling if WS disconnects.
- [ ] **S33.** Real Recharts trend chart on dashboard — pull from `/seller/dashboard/metrics?range=30d` with range picker (7d/30d/90d).
- [ ] **S34.** Mobile responsiveness audit — sidebar to drawer below `lg`, tables to cards below `md`, search to overlay.
- [ ] **S35.** Accessibility audit — keyboard navigation across modal/dialog, ARIA labels on icon-only buttons, focus trapping.
- [ ] **S36.** Empty global error boundary — `app/error.tsx`, `app/global-error.tsx`. Toast on RTK mutation errors via middleware.
- [ ] **S37.** E2E smoke tests (Playwright) — login → create product → add stock → simulate order → fulfill → assert state.
- [ ] **S38.** Optional: dark mode toggle (Tailwind `dark:` variants on primitives).

---

## How v1 and v2 sit relative to each other after this work

After Week 5, v2 will be a superset of v1: it inherits v1's auth/validation/polling/charts/role infra, while keeping its own better-organized routing, command palette, complete returns/RMA workflow, multi-language product copy, fulfillment wizard, and design system polish. At that point **v1 can be retired** unless you specifically need an admin-only portal (in which case v2 with role filtering serves both).

## How to interleave with the backend roadmap

| Backend Day (ROADMAP.md) | Unblocks Seller Portal Day |
|---|---|
| Backend D14 (seller ownership on products) | S25 |
| Backend D43–D45 (file upload + CDN) | S28 |
| Backend D64 (seller onboarding + Stripe Connect) | S16 |
| Backend D65 (`/seller/products`) | S25 |
| Backend D66 (`/seller/orders` projected) | S26 |
| Backend D67–D69 (commission, payouts, seller analytics) | S23, S33 |
| Backend D43 + new `/uploads/signed-url` route | S28 |

Pragmatic order if you're solo: do backend D1–D14 first (critical security/correctness), then alternate weeks between this seller portal roadmap (S1–S14, frontend-only, no backend deps) and the backend (D29–D35 infra + D64–D69 seller endpoints). Then come back to seller portal Week 4 for the wiring.
