# Backend Deep-Scan Report & Daily Roadmap

Consolidated audit of `ecommerce-backend/` covering security, domain correctness, code quality, and feature completeness for a mid-tier e-commerce system. Followed by a day-by-day task plan.

---

## TL;DR — Overall Health

- **Architecture: 8/10.** Modular monolith, event bus + transactional outbox, atomic inventory, replica-set transactions. Foundation is genuinely good.
- **Correctness: 4/10.** Multiple Critical bugs where money or inventory can desync.
- **Security: 4/10.** IDOR on orders, client-controlled payment amounts, no webhook replay protection, no login throttling.
- **Operational readiness: 3/10.** Bull installed but unused, no request IDs, no metrics/APM, 75% of services untested.
- **Feature completeness for "mid-tier": ~45%.** Shipping, tax, coupons, reviews, image upload, saved cards all missing.

The backend is a strong scaffold with bleeding-edge gaps. Most weaknesses are concentrated in **money flow, inventory consistency on edge paths (refund/cancel/fail), and operational scaffolding**.

---

## Critical Findings (must-fix, do these first)

| # | Severity | Title | File |
|---|---|---|---|
| C1 | Critical | IDOR — any authenticated user can read any order by ID | `ecommerce-backend/src/orders/order.service.ts` |
| C2 | Critical | Client-controlled `amount` on `POST /payments/create-intent` (no server-side total check) | `ecommerce-backend/src/payments/payment.controller.ts` |
| C3 | Critical | Stripe webhook has no event-ID dedup → replay marks orders paid twice, double-deducts inventory | `ecommerce-backend/src/payments/payment.service.ts` |
| C4 | Critical | `payment.failed` event omits `items` → inventory listener receives `undefined`, reserved stock never released | `ecommerce-backend/src/payments/payment.service.ts` |
| C5 | Critical | `order.cancelled` has **no listener** — cancelling an order never releases reserved stock | `ecommerce-backend/src/inventory/listeners/inventory-events.listener.ts` |
| C6 | Critical | Refund flow doesn't restock inventory | `ecommerce-backend/src/payments/payment.service.ts` |
| C7 | Critical | Soft-delete filter not applied in `.aggregate()` pipelines — admin revenue charts count deleted orders | `ecommerce-backend/src/admin/admin.service.ts` |
| C8 | Critical | JWT_SECRET defaults to `"change-me-in-production"` with no boot-time validation | `ecommerce-backend/src/config/auth.config.ts` |
| C9 | Critical | 75% of services have zero tests; no e2e tests despite config reference | various |

## High-Severity Findings

| # | Title |
|---|---|
| H1 | No brute-force / per-IP throttling on `/auth/login`, `/auth/register`, `/auth/forgot-password` |
| H2 | Logout deletes refresh token but access token remains valid until natural expiry (no blacklist) |
| H3 | Refresh-token rotation has a TOCTOU race (delete-then-lookup-then-issue) |
| H4 | Password reset doesn't invalidate existing refresh tokens / sessions |
| H5 | No idempotency on `POST /orders` — double-click creates duplicate orders |
| H6 | `PATCH /products/:id` doesn't check seller ownership — any seller can edit any product |
| H7 | Order number is `ORD-yyyymmdd-<4-char-uuid>` → collisions under concurrency throw 500 |
| H8 | Guest→auth cart merge is implemented but **never called on login**, plus silently drops out-of-stock items |
| H9 | Cart price refresh silently removes archived/deleted items without user notification |
| H10 | Async event-listener errors are swallowed — no retry, no DLQ |
| H11 | Production error filter leaks stack traces (`exception.stack` logged + raw `exception.message` to client) |
| H12 | No request/correlation IDs — debugging cross-listener flows is impossible |
| H13 | Schema files declare no explicit `@Index()` for hot query paths (email, slug, sku, userId+createdAt) |
| H14 | Money stored as IEEE-754 floats with `Math.round(x*100)/100` — precision-loss risk |

## Big-Rock Missing Features (blockers for "mid-tier complete")

1. **Shipping system** — carriers, rates, labels, tracking. Currently `shippingCost = 0`. Blocks fulfillment.
2. **Tax calculation** — hardcoded to 0. Blocks any US/EU sales.
3. **Coupons / promotions** — fields exist in schemas but zero logic. Blocks discounts/campaigns.
4. **Product reviews & ratings** — `avgRating`/`reviewCount` exist; no Review collection or endpoints.
5. **File upload / image management** — products store URLs only; no upload endpoint, no CDN, no resize.
6. **Saved cards / Stripe customers** — repeat purchases require re-entering card every time.
7. **Email verification on signup** — `emailVerified` field never enforced.
8. **Seller dashboard** — `UserRole.SELLER` exists but no seller-scoped order/product/payout endpoints.
9. **Returns / RMA workflow** — no schema, no endpoints.
10. **Inventory reservation TTL** — reservations never time out; abandoned checkouts lock stock forever.
11. **Bull queue is installed but used nowhere** — email sending blocks the event emitter.
12. **GDPR data export / account deletion endpoints** — compliance gap.

---

## Daily Todo List (12 weeks, ~1 focused task/day)

Each item is sized for ~3–5 hours of focused work. Days are numbered, not dated — skip weekends or adjust to your pace. Check off `[x]` as you go.

### Week 1 — Stop the bleeding (security + money correctness)

- [ ] **D1.** Fix C1: scope `GET /orders/:id` to owner. Service takes `userId`, controller passes `req.user._id`, query `{ _id, userId }`. Add 403 path. Write a regression test.
- [ ] **D2.** Fix C2: server-side total recompute on `createPaymentIntent`. Reject if client `amount` ≠ recomputed order total. Add `CreatePaymentIntentDto` with class-validator.
- [ ] **D3.** Fix C3: Stripe event-ID dedup. Store processed `event.id` in Redis (24h TTL) before handling. Add a unit test that replays the same event.
- [ ] **D4.** Fix C4: include `items` in `payment.failed` payload by fetching order before emit. Add integration test: failed payment → reserved stock released.
- [ ] **D5.** Fix C5: add `@OnEvent('order.cancelled')` listener that calls `inventoryService.release(...)`. Ensure `updateStatus` enriches the event with order items.
- [ ] **D6.** Fix C6: in `processRefund`, emit `refund.processed` with items and add inventory listener that increments stock. Full and partial refund cases.
- [ ] **D7.** Fix C8: throw at boot if `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MONGODB_URI` are missing or default-valued. Add `Joi`/`zod` env validation.

### Week 2 — Auth hardening

- [ ] **D8.** Add per-IP + per-email throttle on `/auth/login` (5/15min), `/auth/forgot-password` (3/hour), `/auth/register` (10/hour). Use `@nestjs/throttler` named limiters.
- [ ] **D9.** Access-token revocation on logout — push current `jti` into Redis blacklist with TTL = remaining lifetime; check in `JwtStrategy.validate`.
- [ ] **D10.** Email verification flow: token table in Redis, `/auth/verify-email`, block login until verified for new accounts (grandfathered for existing).
- [ ] **D11.** Invalidate all refresh tokens on password reset and password change. Add a `userVersion` int on User; encode in JWT payload; mismatch → 401.
- [ ] **D12.** Fix C7: add `{ $match: { isDeleted: { $ne: true } } }` as the first stage in every `.aggregate()` in `admin/`. Create a `withSoftDeleteFilter()` helper.
- [ ] **D13.** Idempotency on `POST /orders`: accept `Idempotency-Key` header, store `{key → orderId}` in Redis (24h). Replay returns same order.
- [ ] **D14.** Seller ownership check on `PATCH /products/:id`, `DELETE /products/:id`. Admins bypass; sellers must own. Same for `PATCH /products/:id/archive`.

### Week 3 — Domain correctness

- [ ] **D15.** Money model migration: switch all prices/amounts to integer cents in DB. Convert at the API boundary. Add a `Money` value object with `add/subtract/multiply/format`.
- [ ] **D16.** Order number collision fix: bump random suffix to 8 chars from `nanoid` alphabet, plus retry-on-duplicate-key wrapper around create (up to 3 attempts).
- [ ] **D17.** Call `cartService.mergeGuestCart` inside `auth.service.login` when `sessionId` is provided. Stop silent-skip on out-of-stock — return a `mergeResult` with `unavailableItems` so UI can notify.
- [ ] **D18.** Cart price-refresh: don't silently drop archived items. Mark them `unavailable` in the cart summary response; frontend shows a banner.
- [ ] **D19.** Order state-machine guards in service: explicit `ALLOWED_TRANSITIONS` map; reject invalid jumps with 409.
- [ ] **D20.** Inventory reservation TTL — add `reservedUntil` per movement; cron every minute releases expired reservations + emits `inventory.reservation_expired`.
- [ ] **D21.** Cart→order price drift: re-fetch live prices inside the order-creation transaction. If a SKU's price changed, abort with 409 + new prices in the response.

### Week 4 — Validation, error handling, observability

- [ ] **D22.** DTO sweep: add missing DTOs on every controller (payments refund, inventory adjust, all admin endpoints). Custom `IsObjectId` validator. Audit `forbidNonWhitelisted`.
- [ ] **D23.** Production-safe error filter: mask stack traces when `NODE_ENV==='production'`, return generic 500 with an `errorId` the client can quote. Log full stack server-side.
- [ ] **D24.** Request correlation IDs: middleware generates UUID per request; propagate via `AsyncLocalStorage`/`@nestjs/cls`; logger automatically attaches; emit in event payloads.
- [ ] **D25.** Structured JSON logging via `pino` (Nest logger adapter). Redact `password`, `token`, `authorization`, `card`, `email` (mask to `u***@x.com`).
- [ ] **D26.** Wrap every `@OnEvent` handler in a typed `safeHandler(eventType, fn)` that catches, logs with context, records to a `DomainEventFailures` collection with retry count.
- [ ] **D27.** Failed-event retry worker — cron picks up failures with `attempts < 5`, exponential backoff. Send to DLQ on exhaustion. Admin endpoint to list/replay DLQ items.
- [ ] **D28.** Wire up `@nestjs/terminus` readiness probe properly — checks Mongo, Redis, Stripe ping. `/health/ready` separate from `/health/live`.

### Week 5 — Database, performance, infra

- [ ] **D29.** Index audit: add `@Index` decorators or schema `index()` calls for: `User.email` unique, `Product.slug` unique, `Product.sellerId+status`, `Order.userId+createdAt`, `Order.status+createdAt`, `Inventory.variantSku+warehouseId` unique. Run `db.collection.getIndexes()` to verify.
- [ ] **D30.** Add `.lean()` to every read-only query in `product.service.ts`, `order.service.ts`. Measure response time before/after.
- [ ] **D31.** Pagination cap — clamp `limit` to ≤100 globally in PaginationDto. Add `maxLimit` to `class-validator`.
- [ ] **D32.** Wire Bull queue properly: `notifications` queue. Move email sending from inline listener to producer→consumer. Configure retry (3 attempts, exponential backoff).
- [ ] **D33.** Migrate event publisher polling → MongoDB change streams (or accept polling and document it). Add metrics for queue depth.
- [ ] **D34.** Dockerfile: add non-root user, multi-stage build (already exists — review), pin Node version, healthcheck. Compose: remove host port exposure from MongoDB/Redis in `docker-compose.prod.yml`.
- [ ] **D35.** Prometheus metrics: install `prom-client`, expose `/metrics`, instrument HTTP duration, event-processing duration, queue depth, failed-event count.

### Week 6 — Test coverage

- [ ] **D36.** Unit tests for `CartService` — guest cart, auth cart, merge, refresh prices, out-of-stock paths. Target 80% on this file.
- [ ] **D37.** Unit tests for `OrderService` — happy path, state-machine guards, idempotency replay, transaction rollback on inventory fail.
- [ ] **D38.** Unit tests for `InventoryService` — atomic reserve under simulated concurrency (10 parallel reservations on 1 unit; only one should win).
- [ ] **D39.** Unit tests for `PaymentService` — webhook signature pass/fail, replay (dedup hits), refund partial/full, currency mismatch.
- [ ] **D40.** Unit tests for `ProductService`, `UserService`, `NotificationService`, `AdminService`. Mock all DB.
- [ ] **D41.** Set up `test/jest-e2e.json` + `test/` folder. First e2e: register → login → create order → mock-pay → assert inventory deducted, order confirmed.
- [ ] **D42.** GitHub Actions CI: lint + unit + e2e + npm audit. Block merges on failure. Add coverage gate at 70%.

### Week 7 — File uploads + product reviews (revenue blockers)

- [ ] **D43.** Choose CDN (Cloudinary or S3). Add `UploadModule` with signed-URL endpoint for direct browser→CDN upload.
- [ ] **D44.** `POST /products/:id/images` — accept CDN URL, attach to product. `DELETE /products/:id/images/:imageId`. Reorder endpoint.
- [ ] **D45.** Server-side image processing: trigger CDN transformation (thumbnail, 800w, 1600w). Store variants on the Image subdoc.
- [ ] **D46.** Review schema: `{ productId, userId, orderId, rating, title, body, helpfulCount, status, createdAt }`. Verified-purchase check via Order lookup.
- [ ] **D47.** Review endpoints: `POST /products/:id/reviews`, `GET /products/:id/reviews` (paginated), `POST /reviews/:id/helpful`, admin moderation routes.
- [ ] **D48.** Aggregation: on review submit, update product `avgRating` + `reviewCount` atomically. Recompute job for safety.
- [ ] **D49.** Reply-to-review (seller/admin). Notification to reviewer.

### Week 8 — Coupons + saved cards

- [ ] **D50.** Coupon schema: `{ code, type (PERCENT|FIXED|FREE_SHIPPING|BOGO), value, minSubtotal, maxRedemptions, perUserLimit, startsAt, expiresAt, productScope, categoryScope }`.
- [ ] **D51.** Coupon CRUD endpoints under `/admin/coupons` with full DTO validation. Soft delete + history.
- [ ] **D52.** Coupon application on cart — `POST /cart/coupon` validates eligibility, attaches to cart, recomputes summary.
- [ ] **D53.** Coupon application on order — atomic check + increment `redemptionsCount` inside order transaction. Per-user usage check.
- [ ] **D54.** Stripe Customer creation on first checkout. Persist `stripeCustomerId` on User. `POST /payments/setup-intent` returns SetupIntent client_secret.
- [ ] **D55.** Saved payment methods CRUD: list, attach, detach, set default. Endpoints under `/users/me/payment-methods`.
- [ ] **D56.** Checkout flow: select saved method or new card. PaymentIntent with `customer` and `payment_method`.

### Week 9 — Shipping + tax (multi-region readiness)

- [ ] **D57.** Shipping module skeleton + decide provider (EasyPost/Shippo/manual). `ShippingRate` types.
- [ ] **D58.** `POST /checkout/shipping-rates` — given cart + destination, return available methods + costs.
- [ ] **D59.** Persist selected shipping method + cost on order. Update OrderItems to carry weight/dimensions.
- [ ] **D60.** Shipment entity + carrier label generation. `POST /admin/orders/:id/ship` creates label, sets tracking.
- [ ] **D61.** Tracking webhook ingestion endpoint (per provider). Order status transitions on tracking events.
- [ ] **D62.** Tax provider integration (TaxJar/Avalara/manual table). `POST /checkout/tax-quote` for cart preview.
- [ ] **D63.** Persist tax breakdown on order (per line item if needed). Tax-exempt flag on User. Invoices later.

### Week 10 — Seller / multi-vendor

- [ ] **D64.** Seller onboarding: profile schema, KYC fields, Stripe Connect Express account creation. Onboarding link endpoint.
- [ ] **D65.** Seller-scoped product endpoints — `GET /seller/products` filters to `sellerId`. Same on `POST/PATCH/DELETE` (already partially done in D14).
- [ ] **D66.** Seller-scoped order view — `GET /seller/orders` returns orders containing the seller's items, projected to only those items.
- [ ] **D67.** Commission calculation per order item — `commissionPercent` on Seller, computed at order time, stored on OrderItem.
- [ ] **D68.** Payouts job — weekly cron groups completed-and-not-refunded order items by seller, creates a Payout record, triggers Stripe Connect transfer.
- [ ] **D69.** Seller dashboard analytics endpoints: revenue, orders, top products, payout history (scoped).

### Week 11 — Admin + notifications polish

- [ ] **D70.** User management for admin: list with search/filter, ban/unban (toggles `isActive`), force-logout (bump `userVersion`), role change with audit log.
- [ ] **D71.** Audit log collection — `{ actorId, action, entityType, entityId, before, after, ip, ua, at }`. Decorator `@Audit()` to wrap admin endpoints automatically.
- [ ] **D72.** Bulk order actions — bulk status update, bulk export to CSV.
- [ ] **D73.** Email templates: move from inline strings to `nodemailer-express-handlebars` (or similar). Templates per locale.
- [ ] **D74.** Missing notification listeners: `order.delivered`, `refund.processed`, `inventory.low` (→seller/admin). Configurable per-user notification preferences.
- [ ] **D75.** Abandoned cart job — daily cron; cart age > 24h, has items, user has email → send reminder. Track open/click.
- [ ] **D76.** SMS via Twilio (optional channel). Order shipped + delivery SMS. Pref toggle.

### Week 12 — Returns/RMA, GDPR, observability finish

- [ ] **D77.** Return/RMA schema — `{ orderId, items[], reason, status, refundAmount, restockable }`. State machine: requested → approved → received → inspected → refunded/rejected.
- [ ] **D78.** Customer-initiated return endpoint + admin approval flow. On `refunded`, trigger refund + inventory restock.
- [ ] **D79.** GDPR data export — `POST /users/me/export` produces a job; emails a download link with all the user's PII.
- [ ] **D80.** GDPR account deletion — `DELETE /users/me` anonymizes PII (replace email/name/address with hashes), keeps orders for accounting, blocks login.
- [ ] **D81.** APM: install Sentry, init in `main.ts`, capture handled + unhandled. Tag with `requestId`, `userId`, `release`.
- [ ] **D82.** Sitemap generation cron — emit XML to S3/static path; per product/category.
- [ ] **D83.** Buffer: pick up overrun items, polish, write `ARCHITECTURE.md` (modules, event flows, data model) and `RUNBOOK.md` (deploy, rollback, incident response).
- [ ] **D84.** Final security pass: run `npm audit`, `snyk test`, `gitleaks` over history, OWASP ZAP baseline scan against staging.

---

## How to use this list

- **One task per day** is the cadence. Don't combine; small wins keep momentum.
- **Each task ends with a test + a commit.** If the test doesn't exist for that area yet, write it first.
- **Critical block (D1–D7) is non-negotiable** — those are real money/data bugs. Don't ship to anyone before D7 is done.
- **Feature blocks (Weeks 7–12) can be reordered** based on business priority (e.g., if you're not multi-vendor, drop Week 10 entirely and re-shuffle).
- **Skip Week 9 if single-country / single-currency for v1.** Mark `shippingCost` as documented "manual entry by admin" instead.
