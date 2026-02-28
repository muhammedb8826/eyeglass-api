# Bincard

A **bincard** is a stock movement ledger that records every IN and OUT of operator stock per item. Each row represents one movement with date, type, quantity, balance after, and a reference to the source (order, sale, adjustment, etc.).

## API base

All endpoints are under: **`/api/v1/bincard`**

## Endpoints

| Method | Path | Description |
|--------|------|--------------|
| `GET` | `/api/v1/bincard/item/:itemId` | Paginated bincard entries for an item (newest first) |
| `GET` | `/api/v1/bincard/:id` | Single bincard entry by ID |

### Get bincard by item

```
GET /api/v1/bincard/item/:itemId?page=1&limit=50
```

**Query parameters**

- `page` (optional) – Page number, default `1`
- `limit` (optional) – Page size, default `50`

**Response**

```json
{
  "entries": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "movementType": "OUT",
      "quantity": 10,
      "balanceAfter": 90,
      "referenceType": "ORDER",
      "referenceId": "order-uuid",
      "description": "Order item printed/void – stock reduced",
      "uomId": "uuid",
      "createdAt": "2025-02-28T12:00:00.000Z",
      "item": { ... },
      "uom": { ... }
    }
  ],
  "total": 42
}
```

### Get single entry

```
GET /api/v1/bincard/:id
```

Returns one bincard entry with `item` and `uom` relations.

---

## Data model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `itemId` | UUID | Item this movement applies to |
| `movementType` | `'IN'` \| `'OUT'` | Direction of movement |
| `quantity` | number | Quantity moved in this line |
| `balanceAfter` | number | Operator stock balance after this movement |
| `referenceType` | string | Source of the movement (see below) |
| `referenceId` | UUID (optional) | ID of order, sale, etc. when applicable |
| `description` | string (optional) | Human-readable note |
| `uomId` | UUID | Unit of measure |
| `createdAt` | timestamp | When the entry was created |

### Reference types

| Value | Meaning |
|-------|--------|
| `OPENING` | Opening stock when operator stock is created |
| `ORDER` | Stock change from order item (e.g. Printed/Void or restore) |
| `SALE` | Stock change from sale item (e.g. Stocked-out or Cancelled) |
| `PURCHASE` | Stock in from purchase (reserved for future use) |
| `ADJUSTMENT` | Manual quantity change on operator stock (create/update) |

---

## When entries are created

Entries are written automatically by other modules; there is no public API to create bincard rows.

- **Operator stock**
  - **Create** – one `IN` with `referenceType: OPENING` when quantity &gt; 0
  - **Update** – one `IN` or `OUT` with `referenceType: ADJUSTMENT` when quantity changes
  - **reduceStockForOrder** – one `OUT` per item with `referenceType: ORDER`
  - **restoreStockForOrder** – one `IN` per item with `referenceType: ORDER`
- **Order items**
  - Status → Printed/Void: one `OUT` with `referenceType: ORDER`
  - Status away from Printed/Void: one `IN` with `referenceType: ORDER`
- **Sale items**
  - Status → Stocked-out: one `IN` with `referenceType: SALE`
  - Status → Cancelled: one `OUT` with `referenceType: SALE`

---

## Module structure

- **`bincard.controller.ts`** – HTTP endpoints (read-only)
- **`bincard.service.ts`** – `recordMovement()`, `findByItemId()`, `findOne()`; used by Operator Stock, Order Items, and Sale Items
- **`bincard.module.ts`** – Registers controller and service, exports `BincardService`
- **Entity:** `src/entities/bincard.entity.ts`
