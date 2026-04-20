# E-Commerce Backend — NestJS + MongoDB

Mid-tier e-commerce backend with modular monolith architecture, event-driven patterns, and clean separation of concerns.

## Tech Stack

- **NestJS 10** — Modular framework with DI, guards, interceptors
- **MongoDB 7** (Mongoose 8) — Primary database with embedded documents
- **Redis 7** — Guest carts, caching, Bull job queues
- **Stripe** — Payment processing with webhook support
- **Passport.js** — JWT authentication + role-based access
- **Bull** — Background job queue for emails/notifications
- **Docker Compose** — Local development environment

## Quick Start

```bash
# 1. Clone and install
cp .env.example .env
npm install

# 2. Start infrastructure (MongoDB + Redis)
docker compose up -d mongodb redis

# 3. Start the app in dev mode
npm run start:dev

# 4. Open Swagger docs
open http://localhost:3000/docs
```

Or run everything in Docker:
```bash
docker compose up
```

## Architecture

### Modules (10 MVP modules)

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **AuthModule** | `/auth/*` | Register, login, JWT refresh, password reset |
| **UserModule** | `/users/*` | Profile CRUD, addresses |
| **ProductModule** | `/products/*`, `/categories/*`, `/brands/*` | Full catalog with variants, search, categories |
| **InventoryModule** | `/inventory/*` | Stock management with reservation pattern |
| **CartModule** | `/cart/*` | Shopping cart (Redis guest + MongoDB auth) |
| **OrderModule** | `/orders/*` | Checkout, order lifecycle, status history |
| **PaymentModule** | `/payments/*` | Stripe integration, webhooks, refunds |
| **NotificationModule** | `/notifications/*` | Email + in-app notifications |
| **AdminModule** | `/admin/*` | Dashboard stats, order/product management |
| **SharedModule** | — | Event bus, outbox, base schemas, utilities |

### Event-Driven Architecture

Modules communicate via events, not direct imports:

```
order.placed → InventoryModule (reserve stock)
             → PaymentModule (create payment intent)
             → NotificationModule (send confirmation email)

payment.completed → OrderModule (confirm order)
                  → InventoryModule (deduct stock)
                  → NotificationModule (send receipt)

payment.failed → OrderModule (cancel order)
               → InventoryModule (release stock)
               → NotificationModule (notify customer)
```

### Outbox Pattern

Business operations and events are written in the same MongoDB transaction:

```typescript
const session = await this.eventBus.startSession();
session.startTransaction();
const order = await this.orderModel.create([data], { session });
await this.eventBus.emit('order.placed', payload, { session });
await session.commitTransaction();
```

Background worker polls unpublished events and dispatches them. Swap EventEmitter for Kafka later — zero business logic changes.

## API Overview

All endpoints are documented in Swagger at `/docs`. Responses follow a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Key Flows

**Checkout:**
`POST /cart/items` → `GET /cart` → `POST /orders` → `POST /payments/create-intent` → Stripe Elements (frontend) → Stripe Webhook → order confirmed

**Product Search:**
`GET /products?q=keyword&category=electronics&priceMin=50&priceMax=200&rating=4&sortBy=popular`

## Environment Variables

See `.env.example` for all configuration options. Key ones:

- `MONGODB_URI` — MongoDB connection string (use replica set for transactions)
- `REDIS_HOST` — Redis host for carts and job queues
- `JWT_SECRET` — JWT signing key (change in production!)
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret

## MongoDB Design Decisions

- **Products**: Variants, images, attributes embedded (always read together)
- **Orders**: Item snapshots embedded (immutable after placement)
- **Inventory**: Separate collection (high write frequency, avoids product contention)
- **Addresses**: Embedded in User document (small array, always fetched with user)

## Future Phases

- **Phase 2**: Elasticsearch search, shipping module, promotions/coupons, reviews
- **Phase 3**: Returns, analytics, multi-vendor, Kafka migration
