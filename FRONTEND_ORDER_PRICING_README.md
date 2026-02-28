## Orders & Pricing – Frontend Guide

This README explains **how orders use pricing** so the frontend knows:

- what to send when creating/updating orders, and
- how the backend resolves and applies pricing.

For full eyeglass‑specific fields (Rx, bases, etc.) see `FRONTEND_EYEGLASS_README.md`.  
For pricing fields themselves see `FRONTEND_PRICING_README.md`.

---

## 1. Core idea

Each **order item** points to:

- an `itemId` (lens blank),
- optional `itemBaseId` (material base variant),
- optional `serviceId` / `nonStockServiceId`,
- a `pricingId` (or lets the backend resolve it),
- quantity + UOM.

The backend uses the `pricing` row (item + optional base/service) to:

- compute **cost** (`totalCost`) and **sales** (`sales`) per item,
- populate `unit` and `baseUomId` based on UOM conversion.

For eyeglass lens jobs you typically use **item‑only pricing** (no services).

---

## 2. Creating an order that uses pricing

Endpoint:

- `POST /api/v1/orders`

Relevant parts of the body (simplified – see `FRONTEND_EYEGLASS_README.md` for full structure):

```json
{
  "series": "ORD-2026-0001",
  "customerId": "uuid-of-customer",
  "status": "Pending",
  "orderItems": [
    {
      "itemId": "uuid-of-item",
      "itemBaseId": "uuid-of-item-base (optional)",
      "uomId": "uuid-of-uom",
      "baseUomId": "uuid-of-base-uom",
      "quantity": 1,

      "pricingId": "uuid-of-pricing (optional)",

      "unitPrice": 800,
      "totalAmount": 800,

      "status": "Pending",
      "isDiscounted": false,
      "discount": 0,

      "sphereRight": -2.00,
      "sphereLeft": -1.50,
      "...": "other Rx fields as needed"
    }
  ]
}
```

### 2.1 How `pricingId` is used

- If you **provide `pricingId`**:
  - The backend uses that pricing row directly to compute cost/sales.
- If you **omit `pricingId`**:
  - The backend looks up the matching pricing row using:
    - `itemId` (required),
    - optional `itemBaseId`,
    - optional `serviceId` / `nonStockServiceId`,
  - If found, it uses that pricing.
  - If **not found**, it returns a `400 BAD_REQUEST` with a message like:

    > "No pricing found for item … Add item-only pricing or send pricingId."

For eyeglass flows, the simplest approach is:

1. Ensure item‑only pricing exists for each item (+ base) you want to use.
2. Omit `pricingId` in the order payload.
3. Let the backend resolve `pricingId` automatically.

---

## 3. Recommended frontend flow for eyeglass orders

### 3.1 When the user selects an item (and base)

1. User picks **item** and, if applicable, **base** (e.g. 3221 with base 350^+2.5).
2. Frontend calls:

   ```http
   GET /api/v1/items/:id/order-info?itemBaseId=uuid-of-base
   ```

3. Response (`data`) contains:
   - `item` – with UOM and machine (tool),
   - `pricing` – item‑only pricing for that item (+ base), or `null`,
   - `machine` – same as `item.machine`.

4. Frontend:
   - Shows **price** (`pricing.sellingPrice`) and **tool**,
   - If `pricing` is `null`, blocks order creation for that combination and prompts an admin to add pricing.

### 3.2 Building the order payload

For each order item:

- Use:
  - `itemId` from the selected item.
  - `itemBaseId` from the selected base (if any).
  - `uomId` and `baseUomId` typically from the item/pricing (e.g. pcs).
  - `quantity` from the user input.
- Either:
  - Set `pricingId` to `pricing.id` from `order-info`, **or**
  - Omit `pricingId` and rely on backend resolution.
- Compute `unitPrice` and `totalAmount` on the frontend from `pricing.sellingPrice` and `quantity`, or:
  - Use `pricing.sellingPrice` as `unitPrice`,
  - Set `totalAmount = unitPrice * quantity`.

The backend will still recompute internal `unit`, `baseUomId`, `totalCost`, and `sales` from the stored pricing and UOMs.

---

## 4. Updates and deletes

### 4.1 Updating an order

- `PATCH /api/v1/orders/:id`
- You can:
  - change `quantity`, `uomId`, `itemBaseId`, or switch to another `itemId`,
  - send a new `pricingId`, or omit it and let the backend re‑resolve.
- Backend:
  - recalculates `totalCost`, `sales`, and `unit` for each updated line based on the resolved pricing.

### 4.2 Deleting an order or order item

- `DELETE /api/v1/orders/:id` – removes order and its items.
- `DELETE /api/v1/order-items/:id` – removes a single item; the order’s aggregate status/amounts are re‑evaluated.

Pricing rows (`/pricing`) are not automatically deleted when orders are removed; they behave like master data.

---

## 5. Summary

- **Pricing** is defined per `itemId` (+ optional `itemBaseId` and service).
- **Orders** reference pricing implicitly (via `itemId` + base + service) or explicitly (`pricingId`).
- For eyeglass:
  - Prefer **item‑only pricing**.
  - Use `GET /items/:id/order-info` when the user selects an item/base.
  - Let the backend resolve `pricingId` in most cases to keep the frontend simpler.

