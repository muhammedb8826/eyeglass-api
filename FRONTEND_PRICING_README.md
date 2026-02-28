## Pricing API – Frontend Guide

This README explains **how pricing works** and how the frontend should **create and read prices** – especially for eyeglass lens items.

It focuses only on pricing. For other topics:

- Global response format and basics → `FRONTEND_API_README.md`
- Generic app endpoints (auth, users, generic orders) → `FRONTEND_GUIDE.md`
- Eyeglass domain (Rx, items, bases, ADD, orders) → `FRONTEND_EYEGLASS_README.md`

---

## 1. Concept

The `pricing` table defines **how much we charge and what it costs** for:

- a specific **item** (lens blank or other stock item),
- optionally a specific **base variant** (`itemBase`) for eyeglass materials,
- optionally a specific **service** or **non‑stock service**.

For eyeglass lens jobs, you normally use **item‑only pricing**:

- `itemId` (required)
- optional `itemBaseId` (for multi‑base materials like 3221, 1311)
- **no** `serviceId` / `nonStockServiceId`

The backend then uses this pricing when:

- Computing **cost** and **sales** per order item.
- Resolving `pricingId` when you create an order item with only `itemId` (+ optional `itemBaseId`).

---

## 2. Pricing model

Entity: `pricing` (see `src/entities/pricing.entity.ts`)

Key fields:

- `id: string` – UUID
- `itemId: string` – **required**; which item this price belongs to
- `itemBaseId?: string | null` – optional base variant (eyeglass only)
- `serviceId?: string | null` – optional regular service (legacy / generic use)
- `nonStockServiceId?: string | null` – optional non‑stock service
- `isNonStockService: boolean` – flags whether this pricing row is for a non‑stock service
- `sellingPrice: number` – how much we charge (per base unit)
- `costPrice: number` – internal cost (per base unit)
- `baseUomId: string` – base UOM for the pricing (e.g. pcs, pair, m²)

Relations:

- `item` → `Item`
- `itemBase` → `ItemBase` (eyeglass base variant)
- `service` / `nonStockService` → optional services
- `uom` → base UOM

---

## 3. Creating pricing

Endpoint:

- `POST /api/v1/pricing`

Body shape (`CreatePricingDto`):

```json
{
  "itemId": "uuid-of-item",
  "itemBaseId": "uuid-of-item-base (optional)",
  "serviceId": "uuid-of-service-or-null",
  "nonStockServiceId": "uuid-of-non-stock-service-or-null",
  "isNonStockService": false,
  "sellingPrice": 1000,
  "costPrice": 0,
  "baseUomId": "uuid-of-uom"
}
```

### 3.1 Item‑only pricing (recommended for eyeglass)

To define a price for a lens blank (and optional base) **without any service**:

- **Required**:
  - `itemId`
  - `sellingPrice`, `costPrice`
  - `baseUomId`
- **Optional**:
  - `itemBaseId` – when the material has bases (3221, 1311, …)
- **Leave out** (or send `null`, not empty string):
  - `serviceId`
  - `nonStockServiceId`

Example – item‑only pricing for material 3221, base 350^+25:

```json
POST /api/v1/pricing
{
  "itemId": "uuid-of-3221-item",
  "itemBaseId": "uuid-of-3221-base-350-plus-2.5",
  "sellingPrice": 800,
  "costPrice": 400,
  "baseUomId": "uuid-of-pcs-uom"
}
```

Notes:

- Do **not** send `""` (empty string) for `serviceId` / `nonStockServiceId`; the backend normalizes empty strings to `null`, but it’s best to omit them entirely for item‑only pricing.
- The backend prevents **duplicates** per combination of:
  - `itemId`
  - optional `itemBaseId`
  - `serviceId` / `nonStockServiceId` / none (item‑only)

If a duplicate is detected, you get a `409 CONFLICT` with the standard error envelope.

### 3.2 Pricing with services (optional / legacy)

If you want to price an item together with a **service**:

- For regular services:

```json
{
  "itemId": "uuid-of-item",
  "serviceId": "uuid-of-service",
  "sellingPrice": 900,
  "costPrice": 450,
  "baseUomId": "uuid-of-uom"
}
```

- For non‑stock services:

```json
{
  "itemId": "uuid-of-item",
  "nonStockServiceId": "uuid-of-nonstock-service",
  "isNonStockService": true,
  "sellingPrice": 900,
  "costPrice": 450,
  "baseUomId": "uuid-of-uom"
}
```

For the current eyeglass implementation you typically **don’t need services**; item‑only pricing is enough.

---

## 4. Reading pricing

Endpoints:

- `GET /api/v1/pricing?page=&limit=` – paginated list (for admin UIs)
- `GET /api/v1/pricing/all` – full list (use with care; for small datasets / setup tools)
- `GET /api/v1/pricing/:id` – single pricing row

All responses are wrapped in the **standard success/error envelope** described in `FRONTEND_API_README.md`.

For eyeglass UIs you rarely call these directly; instead, you typically use:

- `GET /api/v1/items/:id/order-info?itemBaseId=...`

which returns:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "item": { /* item with machine, uoms, bases */ },
    "pricing": { /* item-only pricing for this item (+ base) or null */ },
    "machine": { /* required tool */ }
  },
  "timestamp": "..."
}
```

Use this to show price and check that pricing exists when the user selects a lens item (and base) for an order line.

---

## 5. How pricing is used in orders

When you create or update orders:

- If you provide a `pricingId` on each `orderItems[]` entry, the backend will **use that directly**.
- If you **omit** `pricingId` and only send:
  - `itemId` (required)
  - optional `itemBaseId`
  - optional `serviceId` / `nonStockServiceId`

then the backend will **resolve `pricingId` automatically** by looking up the matching `pricing` row. If no matching pricing is found, you get a `400 BAD_REQUEST` error with message like:

> "No pricing found for item … Add item-only pricing or send pricingId."

For eyeglass workflows, the recommended flow is:

1. User picks **item** and **base** (if applicable).  
2. Frontend calls `GET /items/:id/order-info?itemBaseId=...` to fetch `pricing` and `machine`.  
3. If `pricing` is **null**, block the form and ask an admin to add pricing for that item (+ base).  
4. When creating the order, either:
   - send that `pricing.id` directly, or
   - omit `pricingId` and let the backend resolve it (preferred for simpler clients).

This keeps all price logic **centralized in the backend**, while the UI only needs to:

- Ensure pricing exists for the chosen item/base, and
- Display price and tool to the user.

