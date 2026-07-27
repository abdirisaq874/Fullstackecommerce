# Product CSV / XLSX Import — Format Guide

This is the spec for the seller bulk-import file (`.csv` or `.xlsx`). The importer
runs each row through the **exact same pipeline as creating one product by hand** —
so everything that happens on single-product create happens here too, at scale:

- **Language:** product names/descriptions/attributes may be in **any language**
  (Turkish, Somali, …). The system auto-translates them to **English** on import
  and keeps the original under the hood. You do **not** need to pre-translate.
- **Auto-enrichment (you don't need to fill these):** `gender`, `age_group`,
  `color`, `material` are **inferred by AI** from the product name/description when
  obvious. Provide them only to override.
- **Per-variant stock** is seeded into real per-SKU inventory (see `variantStock`).
- **Per-variant images** are auto-tagged to their colour so the storefront gallery
  switches correctly.
- **AI also writes** the long description, tags/keywords, and assigns the category.

## File shape — "handle-grouped"

One **product** is one or more **rows that share the same `handle`**:

- The **first row** of a handle carries the product-level fields (name, price, …).
- **Each row** (including the first) describes **one variant** (its options, SKU,
  price, stock, image).
- A product with no variants is just a single row (leave the variant columns blank).

Headers are **case-insensitive** and trimmed. Encoding must be **UTF-8**.

## Columns

### Product-level (read from the first row of each handle)

| Column | Required | Notes |
|---|---|---|
| `handle` | recommended | Groups rows into one product. If omitted, derived from `name`. |
| `name` | **yes** | Any language — auto-translated to English. |
| `brand` | no | Brand name. |
| `basePrice` | **yes** | Number, e.g. `29.99`. Zero/blank rows are rejected. |
| `compareAtPrice` | no | "Was" price → shown as a strike-through sale. |
| `currency` | no | Default `USD`. |
| `stock` | no | Used only for **no-variant** products. For variant products, per-variant `variantStock` is summed automatically. |
| `status` | no | `draft` (default) \| `active` \| `archived`. |
| `imageUrls` | recommended | One or more URLs, separated by `|` or newlines. Shared across all variants. |
| `sourceUrl` | no | Original product URL (kept as import metadata). |
| `attributes` | no | Extra specs as `key:value` pairs joined by `|`, e.g. `heel_type:flat\|pattern:solid`. Keys are normalized to English. |

### Variant-level (read from every row)

| Column | Required | Notes |
|---|---|---|
| `variantSku` | recommended | Unique per variant. Auto-generated if blank. Inventory is keyed per (product, SKU), so the **same supplier SKU may be reused by different sellers** safely. |
| `option1Name` / `option1Value` | for variants | e.g. `Color` / `Black`. |
| `option2Name` / `option2Value` | no | e.g. `Size` / `42`. |
| `option3Name` / `option3Value` | no | A third dimension if needed. |
| `variantPrice` | no | Overrides `basePrice` for this variant. |
| `variantStock` | **NEW** | Per-variant on-hand quantity → seeded into per-SKU inventory. This is what makes "out of stock" show per size/colour instead of for the whole product. |
| `variantBarcode` | no | **UPC / EAN / GTIN** — see below. Fed to Meta/Google as `g:gtin` (improves ad delivery). |
| `variantWeightGrams` | no | For shipping. |
| `variantImageUrl` | no | One image for this variant; auto-tagged to its colour. |

## What GTIN / barcode does for you

`variantBarcode` should hold the product's **GTIN** — the global barcode number on
the physical product: **UPC** (12 digits, US), **EAN** (13 digits, EU), or **GTIN**
(the umbrella term). It is **not** your internal SKU.

Why it matters: Meta and Google use GTIN + brand to **match your product to their
global catalog**. With a valid GTIN, ads get **cheaper, better-targeted delivery**
and avoid "missing unique identifier" warnings that throttle reach. Without it, your
listing competes blind. So: if the supplier gives you the barcode number, put it in
`variantBarcode` — it directly helps your ad performance. (We only forward it to the
feed when it's a valid 8–14 digit number, so a random SKU there is simply ignored.)

## Examples

**Single product (no variants):**

```csv
handle,name,basePrice,stock,imageUrls,attributes
yoga-mat,Yoga Mat Pro 6mm,24.99,150,https://cdn/img1.jpg|https://cdn/img2.jpg,material:tpe|thickness:6mm
```

**Variant product (2 colours × 2 sizes = 4 rows):**

```csv
handle,name,basePrice,imageUrls,variantSku,option1Name,option1Value,option2Name,option2Value,variantStock,variantBarcode,variantImageUrl
esport-104,E SPORT Sneaker,39.90,https://cdn/main.jpg,104-WHI-40,Color,White,Size,40,12,8690000000017,https://cdn/white.jpg
esport-104,,,,104-WHI-41,Color,White,Size,41,0,8690000000024,
esport-104,,,,104-BLK-40,Color,Black,Size,40,7,8690000000031,https://cdn/black.jpg
esport-104,,,,104-BLK-41,Color,Black,Size,41,5,8690000000048,
```

Notes on the example:
- Product-level fields (`name`, `basePrice`, `imageUrls`) sit on the **first row only**.
- `variantStock` differs per row → the White/41 shows **out of stock**, others show their real counts.
- `variantImageUrl` on the White and Black rows → the gallery switches by colour automatically.
- The name could be Turkish ("E SPORT Erkek Spor Ayakkabı") — it lands in the catalog in English.

## Fields you do NOT put in the CSV (handled for you)

- English name/description, `slug`, `gender`, `age_group`, `color`, `material`,
  category, tags/keywords, embeddings, and per-SKU inventory records — all derived
  automatically. Provide `attributes` only to add specs the AI can't infer.

## Coming soon (planned optional columns)

`condition` (new/used/refurbished), package `dimensions` (L×W×H for shipping). Until
then, all products are treated as **new**.
