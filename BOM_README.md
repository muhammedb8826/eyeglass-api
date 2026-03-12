## Bill of Materials (BOM) – Usage Guide

This backend now supports a **Bill of Materials (BOM)** per lens item so lab technicians know **exactly what to request from inventory** when an order is placed.

---

## 1. Concept

- **Parent item**: the finished good being produced (e.g. a specific lens blank `Item`).
- **Component items**: the materials that must be **stocked out from inventory** to the lab to produce one unit of the parent item.
- **BOM**: a list of component items with quantities and units for each parent item.

When an order is placed for a lens item that has a BOM, order item APIs return those BOM lines so the lab technician can:

- See which items to ask the store for.
- See how much of each item is needed for the ordered quantity.

---

## 2. Data model

### 2.1 `Bom` entity

Table: `bom`

- `id: uuid` – primary key.
- `parentItemId: uuid` – the finished good (`Item.id`) that uses this BOM line.
- `componentItemId: uuid` – the component item (`Item.id`) that must be issued from store.
- `quantity: number` – quantity of the component (in the given UOM) required to produce **1 unit** of the parent item.
- `uomId: uuid` – the UOM for the component (e.g. `pcs`).

Relations:

- `parentItem: Item` – many `Bom` rows → one parent `Item`.
- `componentItem: Item` – many `Bom` rows → one component `Item`.
- `uom: UOM` – UOM of the component quantity.

### 2.2 `Item` side

Each `Item` now has:

- `bomLines: Bom[]` – its list of BOM components.

---

## 3. How the frontend / lab uses BOM

### 3.1 Reading BOM with order items

`OrderItemsService` loads BOM relations so order item APIs return BOM information automatically:

- `GET /api/v1/order-items/:orderId`
- `GET /api/v1/order-items/all`
- `GET /api/v1/order-items/:id`

Each order item now includes:

- `item.bomLines[]`
  - `bomLines[].componentItem` – the component `Item` (name, code, etc.).
  - `bomLines[].quantity` – quantity per **1** parent unit.
  - `bomLines[].uom` – UOM for that quantity.

### 3.2 Calculating what to request from store

For each order item:

1. Read:
   - `orderItem.quantity` – total quantity of the parent lens item.
   - `orderItem.item.bomLines[]` – components.
2. For each BOM line:
   - `requiredQuantity = bom.quantity * orderItem.quantity`
3. Display to lab technician as a **store request checklist**, e.g.:

```text
To produce this order line:
- 2 × PADS (component item name), UOM = pcs
- 1 × BLANK-123 (component item name), UOM = pcs
```

The lab technician passes this list to the **store**, which performs the stock-out from main inventory to the lab.

### 3.3 Example API response shape (with BOM)

Example fragment from `GET /api/v1/orders/:id` (one order item only, simplified):

```json
{
  "id": "order-id",
  "series": "LENS-2026-0001",
  "orderItems": [
    {
      "id": "order-item-id",
      "itemId": "parent-item-id",
      "quantity": 2,
      "status": "Pending",
      "approvalStatus": "Pending",
      "qualityControlStatus": "Pending",
      "item": {
        "id": "parent-item-id",
        "itemCode": "3221",
        "name": "Progressive plastic solar",
        "bomLines": [
          {
            "id": "bom-line-1",
            "parentItemId": "parent-item-id",
            "componentItemId": "component-blank-id",
            "quantity": 1,
            "uomId": "uom-pcs-id",
            "componentItem": {
              "id": "component-blank-id",
              "itemCode": "BLANK-123",
              "name": "Base blank 70mm"
            },
            "uom": {
              "id": "uom-pcs-id",
              "name": "Piece",
              "abbreviation": "pcs"
            }
          },
          {
            "id": "bom-line-2",
            "parentItemId": "parent-item-id",
            "componentItemId": "component-pad-id",
            "quantity": 1,
            "uomId": "uom-pcs-id",
            "componentItem": {
              "id": "component-pad-id",
              "itemCode": "PAD-001",
              "name": "Blocking pad"
            },
            "uom": {
              "id": "uom-pcs-id",
              "name": "Piece",
              "abbreviation": "pcs"
            }
          }
        ]
      }
    }
  ]
}
```

From this payload the lab can compute, for `quantity = 2`:

- `BLANK-123`: `1 × 2 = 2 pcs`
- `PAD-001`: `1 × 2 = 2 pcs`

---

## 4. Managing BOM data

Right now, BOM is modeled in the backend and joined into order item responses. You can manage the data in any of these ways:

- **Direct DB inserts/updates** to `bom` table (for initial setup or migrations).
- **Future admin UI** / API:
  - e.g. endpoints under `/bom` or `/items/:id/bom` to create, list, update, and delete BOM lines per parent item.

Recommended practice:

- Keep BOM small and clear (only items that must be issued from store).
- Use the same UOMs that inventory uses (e.g. `pcs`, `pair`) so store and lab speak the same units.

---

## 5. Summary

- **BOM = recipe** for each lens item.
- Stored in `bom` table; linked to `Item`.
- Included automatically in order item APIs as `item.bomLines`.
- Lab uses BOM to know **what** and **how much** to request from store; store uses existing inventory flows to stock out those items to the lab.

