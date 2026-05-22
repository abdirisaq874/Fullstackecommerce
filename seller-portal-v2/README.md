# Gaarsii Seller Portal — v2

Seller-facing store management portal for Gaarsii Global (Turkey ↔ East Africa cross-border e-commerce). Built with Next.js 14 App Router, RTK Query, and Tailwind.

## What's in this build

This is the **Phase 1 + 2 + 5** delivery:

### Phase 1 — Operational core
- Product list **bulk operations**: publish, feature, archive, export
- **CSV import** with column mapping flow (upload → map → review)
- **CSV export** for products and orders
- Full **order fulfillment wizard** (`/orders/[id]/fulfill`) — pack → pick → ship → done, with printable packing slip including customs declaration for cross-border parcels
- **Returns / RMA module** with full state machine: requested → approved → received → inspected (with refund decision) → refunded / rejected

### Phase 2 — Analytics + comms (doc-driven)
- **Dashboard rebuilt to the doc's seller-overview structure**:
  - Top KPI row (gross sales, net revenue, profit, orders)
  - Revenue trend chart + **profit truth** breakdown (product cost, platform fee, payment fee, shipping, refunds)
  - **Today actions** card + **store health** composite score
  - **Winning / sliding products** leaderboards
  - **Fix / Watch / Scale action board** at the bottom
- **Per-product analytics** page (`/products/[id]/analytics`) — views, conversion, return rate, recent orders, variant performance
- **Finance reports** page (`/finance/reports`) — revenue by destination/category/channel + cohort retention table
- **Customer messages** with inbox, thread view, reply composer
- **Multi-language support** on product form basics — per-locale tabs for EN/TR/SO/SW/AM with completeness indicators

### Phase 5 — Polish
- Cmd+K **command palette** searching across products, orders, inventory, and messages
- **Notifications panel** behind the bell icon with category icons and read state
- **Toast system** for action confirmations
- **Loading skeletons** on every table and card
- **Error states** with retry on every page that fetches
- **Empty states** with calls to action
- Print stylesheet for packing slips
- Optimistic cache invalidation via RTK Query tags

## Stack

- **Next.js 14.2** App Router + Server Components for layout
- **React 18** with TypeScript strict mode
- **Redux Toolkit + RTK Query** for all data fetching and mutations
- **Tailwind CSS** for styling with a warm-stone + forest-green design system
- **lucide-react** for icons
- **DM Sans + Instrument Serif** as font pairing (display/body)

## Directory structure

```
app/
├── (portal)/              # All authenticated routes share this layout (sidebar + topbar)
│   ├── dashboard/
│   ├── products/
│   │   ├── new/
│   │   └── [id]/
│   │       ├── edit/
│   │       └── analytics/
│   ├── orders/[id]/{fulfill}/
│   ├── inventory/[sku]/
│   ├── returns/[id]/
│   ├── messages/[id]/
│   ├── customers/
│   ├── marketing/
│   ├── finance/reports/
│   ├── shipping/
│   └── settings/
├── layout.tsx             # Fonts + Redux provider
└── page.tsx               # Redirects to /dashboard

components/
├── primitives/            # Button, Badge, Card, Input, Field, Alert, Modal — generic
├── data/                  # DataTable, EmptyState, ErrorState, TableSkeleton
├── layout/                # Sidebar, Topbar, CommandPalette, NotificationsPanel, etc.
├── product/               # ProductForm, VariantsEditor, DimensionRow, CsvImportModal
├── order/                 # OrderStatusFlow, OrderItemsList
├── dashboard/             # MetricCard, TrendChart, ActionBoard, ProfitTruth, etc.
├── inventory/             # StockBar
└── shared/                # Money, CountryFlag

lib/
├── api/                   # All RTK Query slices + store
│   ├── base-api.ts        # ← Swap fakeBaseQuery() to fetchBaseQuery() here for real backend
│   ├── products-api.ts
│   ├── orders-api.ts
│   ├── inventory-api.ts
│   ├── returns-api.ts
│   ├── messages-api.ts
│   ├── dashboard-api.ts
│   ├── ui-slice.ts        # Non-server state (toasts, palette, panels)
│   ├── store.ts
│   └── mock-db.ts         # ← In-memory dev data; delete when wiring real backend
├── hooks/                 # useToast, useHotkey
├── types/                 # All domain types (Product, Order, Return, etc.)
└── utils/                 # Formatters, status mapping, DTO builder, CSV utils, variant logic
```

## Wiring to your NestJS backend

1. Open `lib/api/base-api.ts`. Replace `fakeBaseQuery()` with:

   ```ts
   import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

   baseQuery: fetchBaseQuery({
     baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
     prepareHeaders: (headers, { getState }) => {
       // attach JWT from your auth slice / cookie
       return headers;
     },
   }),
   ```

2. In each `lib/api/*-api.ts`, replace `queryFn` blocks with `query` definitions:

   ```ts
   listProducts: builder.query<Product[], void>({
     query: () => '/products',
     providesTags: [...],
   }),
   createProduct: builder.mutation<Product, CreateProductDto>({
     query: (body) => ({ url: '/products', method: 'POST', body }),
     invalidatesTags: [...],
   }),
   ```

3. Delete `lib/api/mock-db.ts` once real endpoints are live.

4. The DTO shape sent by `buildProductDto()` in `lib/utils/index.ts` already matches your `CreateProductDto` exactly — no changes needed there.

5. Cache invalidation tags are already wired correctly. A mutation on one screen will automatically refetch the lists everywhere.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/dashboard`.

## Notes

- All mutations are optimistic via RTK Query tag invalidation
- The command palette is reachable via Cmd+K (Ctrl+K on Windows/Linux)
- The variant editor uses a **dimensions-first** model — define Size and Color once at the top, the variant grid auto-generates as an editable table
- The fulfillment wizard's packing slip is a real printable view (Cmd+P) with a print stylesheet that hides sidebar/topbar
- Multi-language fields use **English as canonical** — empty translations fall back to English at the storefront layer
