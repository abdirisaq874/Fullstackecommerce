# Email Events — Design & Backlog

Living catalog of every email event for the Gaarsii **multi-store marketplace**.
Grounded in the real system: COD checkout, orders **split one-per-store**, store
membership (owner/manager/staff), per-store payouts, returns, the existing
`EventBusService` + BullMQ (`BullModule`). Check items off as they ship.

**Tiers:** `[Core]` MVP · `[Std]` expected at mid-tier · `[Adv]` growth/scale · `[Mktg]` marketing (needs consent + one-click unsubscribe).

---

## Phase 1 — MVP (build these first)

A rounded MVP: the full buyer order journey (happy + failure + refund), the two
seller essentials, auth basics, and the staff invite (without which the
multi-store staff feature can't function). Some are `[Std]`, kept in because they
make the product feel complete.

**Buyer — order journey**
- [ ] Order received (COD: "pay $X on delivery") — `order.createFromCart`
- [ ] Order confirmed / accepted by store — `pending → confirmed`
- [ ] Order shipped (+ tracking if present) — `→ shipped`
- [ ] Order delivered — `→ delivered`
- [ ] Order cancelled (by seller or buyer, with reason) — `→ cancelled`

**Buyer — returns/refunds (minimal, trust-critical)**
- [ ] Return requested — acknowledgement — returns: created
- [ ] Refund issued / processed — refund posted

**Seller — critical ops**
- [ ] New order for your store — order lands for store → owner + managers
- [ ] Payout paid / completed — payout settled → store owner

**Account / auth**
- [ ] Email verification — signup
- [ ] Password reset — `auth.resetPassword`

**Staff / membership (required for the staff feature)**
- [ ] Staff invite (accept link) — `StoreMembership status:'invited'`

**Cheap wins (optional add-ons to the MVP)**
- [ ] Welcome (buyer + seller) — after verify / first login
- [ ] Store-profile incomplete nudge — empty `store.displayName` (already detected in the dashboard)

**Deliberately deferred from MVP:** all `[Mktg]`, abandoned cart, back-in-stock,
digests, performance/policy warnings, KYC, 2FA, tax documents, admin summaries,
online-payment emails (COD today).

---

## Cross-cutting design (applies to EVERY email)

- **Category** — `transactional` vs `marketing`. Marketing requires consent + one-click unsubscribe; transactional does not and gets deliverability priority.
- **Idempotency key** — `eventType + aggregateId` (+ status where relevant). Prevents double-sends on retries/webhooks. Backed by an `EmailLog` collection.
- **Locale** — buyer emails in the buyer's language; seller emails in `store.preferredLanguage` (EN/SO).
- **Sender identity** — platform verified domain; `From` branded with `store.displayName`; `reply-to = store.supportEmail`.
- **Recipient resolution** — store events expand to members by role (owner + managers), honoring `store.notifications` prefs.
- **Delivery** — enqueue to BullMQ; track status via provider (Resend) webhooks on `EmailLog`.
- **Multi-store split** — a multi-store cart → one consolidated buyer "order received" email; shipping/delivery emails are per-store thereafter.

---

## Full catalog (backlog)

### 1. Account & Authentication (buyers + sellers)
- [ ] Email verification — signup — `[Std]`
- [ ] Welcome — after verify / first login — `[Std]`
- [ ] Password reset — reset requested — `[Core]`
- [ ] Password changed confirmation — after reset/change (`logoutAll`) — `[Std]`
- [ ] New-device / new-location sign-in — login from unknown device — `[Std]`
- [ ] 2FA / OTP code — 2FA login — `[Adv]`
- [ ] Email-address change (confirm old + new) — profile email change — `[Std]`
- [ ] Account suspended / reactivated — admin action — `[Std]`
- [ ] Data-export ready / account-deletion confirm — GDPR request — `[Adv]`

### 2. Buyer — Order lifecycle
- [ ] Order received (COD: pay on delivery) — `order.createFromCart` — `[Core]`
- [ ] Order confirmed / accepted by store — `pending → confirmed` — `[Core]`
- [ ] Order being processed / packed — `→ processing` — `[Std]`
- [ ] Order on hold / needs action — stock/address issue — `[Std]`
- [ ] Order cancelled by buyer — buyer cancels — `[Std]`
- [ ] Order cancelled by seller (out of stock) — seller cancels — `[Std]`
- [ ] Partial-order update (one store in a multi-store cart changed) — sub-order state change — `[Std]`
- [ ] Order edited / items changed — order mutation — `[Adv]`

### 3. Buyer — Fulfillment / shipping
- [ ] Shipped / dispatched (+ tracking) — `→ shipped` — `[Core]`
- [ ] Out for delivery — carrier webhook — `[Adv]`
- [ ] Delivered — `→ delivered` — `[Std]`
- [ ] Delivery failed / re-attempt — carrier webhook — `[Adv]`
- [ ] Delay notification — SLA/carrier delay — `[Adv]`

### 4. Buyer — Returns / refunds / disputes
- [ ] Return requested (ack) — returns: created — `[Std]`
- [ ] Return approved + RMA/instructions — returns: approved — `[Std]`
- [ ] Return received — returns: received — `[Std]`
- [ ] Refund issued / processed — refund posted — `[Std]`
- [ ] Return rejected — returns: rejected — `[Std]`
- [ ] Exchange shipped — exchange fulfilled — `[Adv]`
- [ ] Chargeback / dispute ack — dispute opened — `[Adv]`

### 5. Buyer — Payments (for when online/card payment arrives — today it's COD)
- [ ] Payment receipt / invoice — payment captured — `[Core]`¹
- [ ] Payment failed — gateway failure — `[Std]`¹
- [ ] Payment pending / awaiting — async method — `[Std]`¹
- [ ] COD reminder (day before delivery) — scheduled pre-delivery — `[Opt]`
- [ ] Tax invoice / receipt PDF — order complete — `[Std]`

¹ Only meaningful once online payment exists; today "receipt" folds into "Order received."

### 6. Buyer — Engagement (transactional↔marketing boundary)
- [ ] Abandoned-cart reminder — cart idle N hrs — `[Std]`
- [ ] Back-in-stock — wishlist item restocked — `[Std]`
- [ ] Price-drop on saved item — price change — `[Adv]`
- [ ] Review request (post-delivery) — delivered + N days — `[Std]`
- [ ] Loyalty / rewards update — points change — `[Adv]`
- [ ] Win-back / "we miss you" — inactivity — `[Mktg]`
- [ ] Newsletter / promotions / recommendations — campaign — `[Mktg]`

### 7. Seller — Onboarding & account
- [ ] Seller application received — signup — `[Std]`
- [ ] Seller approved / rejected — admin review — `[Std]`
- [ ] Store created / go-live — `stores.createStore` — `[Std]`
- [ ] Store-profile incomplete nudge — empty `displayName` — `[Std]`
- [ ] KYC / verification required / approved — verification flow — `[Adv]`
- [ ] Payout method setup required — missing `payouts` config — `[Std]`

### 8. Seller — Order & fulfillment ops
- [ ] New order for your store — order lands → owner + managers — `[Core]`
- [ ] New-order daily digest — scheduled — `[Opt]`
- [ ] Awaiting-confirmation / SLA reminder — order `pending` too long — `[Std]`
- [ ] Order cancelled by buyer — buyer cancels — `[Std]`
- [ ] Ship-by / late-shipment warning — SLA breach — `[Std]`
- [ ] Return/dispute filed against your order — returns: created — `[Std]`

### 9. Seller — Inventory
- [ ] Low-stock alert — inventory ≤ threshold — `[Std]`
- [ ] Out-of-stock alert — qty hits 0 — `[Std]`
- [ ] Restock reminder — scheduled — `[Opt]`
- [ ] Product approved / rejected — catalog moderation — `[Adv]`

### 10. Seller — Finance & payouts
- [ ] Payout initiated / scheduled — seller-finance payout — `[Std]`
- [ ] Payout paid / completed — payout settled — `[Core]`
- [ ] Payout failed — payout error — `[Std]`
- [ ] Earnings statement (weekly/monthly) — scheduled — `[Std]`
- [ ] Refund deducted from balance — refund posted — `[Std]`
- [ ] Fee / commission change notice — policy change — `[Adv]`
- [ ] Year-end tax document — scheduled — `[Adv]`

### 11. Seller — Performance / reviews / policy
- [ ] New review received — review created — `[Std]`
- [ ] Buyer message received — messages: new thread/reply — `[Std]`
- [ ] Policy violation / listing removed — admin action — `[Std]`
- [ ] Rating / performance-drop warning — metric threshold — `[Adv]`

### 12. Staff & membership (multi-store specific)
- [ ] Staff invite (accept link) — `StoreMembership status:'invited'` — `[Core]`
- [ ] Invite accepted (notify inviter) — membership → active — `[Opt]`
- [ ] Role changed — membership role update — `[Std]`
- [ ] Access revoked / removed — membership → revoked — `[Std]`
- [ ] Ownership transfer — owner change — `[Adv]`

### 13. Admin / platform
- [ ] New seller awaiting approval — seller signup — `[Std]`
- [ ] Fraud / abuse / suspicious-order flag — risk rule — `[Adv]`
- [ ] Daily platform summary — scheduled — `[Opt]`
- [ ] SLA breach / escalation — ops rule — `[Adv]`

### 14. System / compliance / legal
- [ ] Terms / Privacy updated — policy change — `[Std]`
- [ ] Security incident / breach notice — incident — `[Compliance]`
- [ ] Scheduled maintenance / downtime — ops — `[Opt]`
- [ ] Seller subscription/plan billing — if sellers pay a fee — `[Adv]`
