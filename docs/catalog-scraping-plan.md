# Catalog Scraping Plan — 10,000 products (general marketplace, Muslim audience)

Goal: a **wide, general-purpose catalog of ~10,000 distinct products** (count each product
once — its size/colour variants don't count) before we run Meta/Google ads.

**Framing:** a **general everyday marketplace** (electronics, home, kitchen, beauty,
fashion, kids, sports, tools, auto, garden, office…) served to a Muslim audience — **not**
a religious store. The only light-touch adjustments for the audience:
1. **Keep fashion modest** — everyday clothing; skip revealing items.
2. **Fragrance** — prefer **alcohol-free attar/oud**.
3. Keep a small **Ramadan/Eid** seasonal collection (decor, gifts, dates gift boxes).

Today's ~1,686 active are generic accessories (shoes, headphones, screen protectors,
chargers, sunglasses) — good filler, but too narrow. This plan spreads across 14
departments for full breadth + ad-testing depth.

## Target allocation (≈10,000)

| # | Department | Target | % | Core product types to scrape |
|---|---|---:|---:|---|
| 1 | **Fashion & Apparel** (modest) | 1,650 | 16.5% | Everyday tops, dresses, trousers, jackets, outerwear, knitwear, loungewear, abaya/kaftan/thobe. Skip revealing items. |
| 2 | **Home & Kitchen** | 1,250 | 12.5% | Cookware, dinnerware & serving sets, kitchen gadgets, storage, decor, bedding, bath, cleaning, small appliances |
| 3 | **Electronics & Accessories** | 1,150 | 11.5% | Earbuds/headphones, chargers/cables, power banks, smartwatches, speakers, phone/PC/TV accessories, gadgets, lighting |
| 4 | **Health & Beauty** | 950 | 9.5% | Skincare, cosmetics, haircare, grooming, personal care, supplements, fragrance (perfume + **alcohol-free attar/oud**) |
| 5 | **Kids & Baby** | 800 | 8% | Baby care, kids' clothing (modest), feeding, nursery, kids' shoes |
| 6 | **Bags, Shoes & Accessories** | 700 | 7% | Shoes, handbags, wallets, luggage, watches, sunglasses, belts, jewelry |
| 7 | **Major / Consumer Electronics** ⚠️ | 700 | 7% | Smartphones, tablets, laptops, monitors, TVs, cameras, gaming consoles & accessories, printers, smart-home |
| 8 | **Sports, Fitness & Outdoor** | 500 | 5% | Fitness gear, sportswear (modest), outdoor, camping, cycling |
| 9 | **Furniture & Larger Home** ⚠️ | 450 | 4.5% | Flat-pack furniture, shelving, desks/chairs, storage units, mattresses, large rugs, mirrors, light fixtures |
| 10 | **Automotive** | 400 | 4% | Car care (wash/wax), interior organizers, seat covers & mats, phone mounts, dash cams, air fresheners, exterior accessories |
| 11 | **Garden & Outdoor / Patio** ⚠️ | 400 | 4% | Patio furniture, planters & (artificial) plants, garden tools, outdoor lighting, BBQ/grills, umbrellas, outdoor storage |
| 12 | **Seasonal — Ramadan & Eid** | 400 | 4% | Lanterns/fanoos, Eid decor, gift sets, Ramadan calendars, **dates gift boxes** (shelf-stable/halal), gathering supplies |
| 13 | **Tools & DIY** | 350 | 3.5% | Hand tools, power tools, hardware, measuring, safety gear, organizers, adhesives |
| 14 | **Light Office & Stationery** | 300 | 3% | Pens, notebooks, planners, desk organizers, printer supplies, calculators, art/craft supplies |
| | **Total** | **10,000** | | |

## Fulfillment note (⚠️ departments)

Major/Consumer Electronics, Furniture & Larger Home, and parts of Garden/Patio are
**higher-value or bulky** — they need a fulfillment answer before you scale them:
shipping cost/size, warranty/returns (electronics), and fitment (auto). Kept deliberately
**moderate** (~15% combined) so the catalog stays broad without over-committing to hard-to-ship
stock. Prove logistics on a small batch first, then deepen.

## Audience rules (light-touch)

- **Fashion:** modest/everyday; skip revealing clothing.
- **Fragrance:** prefer **alcohol-free attar/oud**.
- **Seasonal food items** (dates gift boxes) must be **shelf-stable + halal**. No general perishable grocery in v1 (cold-chain).
- No alcohol, gambling, or pork categories.

## Seasonality — scrape ahead

Sales spike around **Ramadan** and both **Eids**. Have the seasonal slice + new outfits +
fragrance + serving/dinnerware deep **6–8 weeks before** — the biggest ad windows of the
year, on top of a normal year-round general catalog.

## Ad-readiness — how the mix maps to campaigns

- **Cold / prospecting** (visual, impulse, ~$5–30): phone & home gadgets, earbuds, kitchen tools,
  beauty/attar, kids' items, auto accessories, garden gadgets. Cheap, giftable — these surface your winners.
- **Higher-AOV / retargeting**: fashion, consumer electronics, furniture, luggage, appliances.
- **Depth for testing:** 14 departments = many audiences × creatives. Aim for **≥150–200 live
  products per department** at launch so ad sets aren't starved.

## Data to grab per scraped product (so the ad feed is clean)

- **Name / description** — any language (auto-translated to English), but capture the source text.
- **Price + compare-at**, **currency**, multiple **image** URLs (per-colour image if available).
- **GTIN / barcode** (UPC/EAN) — a real barcode number, **not** the site's product-id/ASIN. Boosts ad delivery; grab when shown.
- **Brand**, source **category**.
- **gender / age_group / color / material** — auto-detected; capture only if the source is explicit and the item is ambiguous.
- **condition** — default "new"; set only if used/refurbished.
- **Variants** (size/colour) + per-variant `variantStock` + `variantBarcode`.

See [csv-import-format.md](csv-import-format.md) for exact upload columns.

## Suggested scraping sources

- **General / home / tools / auto / garden / office:** Amazon, AliExpress, Trendyol.
- **Fashion (modest):** Trendyol, Modanisa, Sefamerve, Namshi.
- **Major electronics & furniture:** prefer distributor/wholesale catalogs over scrape-and-dropship (warranty, bulk shipping).

## Rollout suggestion

1. Build **breadth first** — ~150–200 products across every department (≈2,000–2,800 to start) so ads have inventory to test.
2. Deepen the **best cold-ad categories** (electronics accessories, home/kitchen, beauty, kids, auto) toward their targets.
3. Layer fashion + the ⚠️ departments (major electronics, furniture, garden) **only after** logistics are proven on a small batch.
4. Import per-department in batches (bulk CSV is idempotent per handle) and QA a sample before ads.
