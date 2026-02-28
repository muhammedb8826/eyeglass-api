## Eyeglass Lens API – Frontend Integration Guide

This backend is configured for **eyeglass lens production**.  
This README explains how a frontend should **send and read data** for the eyeglass‑specific fields.

It does **not** prescribe any frontend framework or UI code – only the HTTP contract.

---

## 1. Basics

- **Base URL**: same as in `FRONTEND_GUIDE.md` (e.g. `http://host:8080/api/v1`)
- **Auth**: Bearer JWT in `Authorization` header
- All new fields are **optional**; existing flows work if you don’t send them.

High‑level concepts:

- **Customer** → Patient (with optional date of birth, gender)
- **Order** → Lens job / prescription order
- **Order item** → One lens job line (usually a pair, sometimes one lens)
- **Item** → Lens blank / product in stock

---

## 2. Customer (Patient) Data

### 2.1 New fields on `Customer`

The `customers` endpoints now include:

- `dateOfBirth: string | null` – ISO date `YYYY-MM-DD`
- `gender: string | null`

### 2.2 Example create / update payload

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+251900000000",
  "address": "123 Main St",
  "dateOfBirth": "1980-05-12",
  "gender": "MALE"
}
```

When reading from `GET /api/v1/customers` or `GET /api/v1/customers/:id`, these fields are present if set.

---

## 3. Order-Level Prescription Metadata

### 3.1 New fields on `Order`

Via `CreateOrderDto` / `UpdateOrderDto`:

- `prescriptionDate?: string` – ISO datetime or date
- `optometristName?: string`
- `urgency?: string` – e.g. `"STANDARD"`, `"RUSH"`

### 3.2 Example `POST /api/v1/orders` body (simplified)

```json
{
  "series": "ORD-2025-0001",
  "customerId": "uuid-of-customer",
  "status": "Pending",
  "orderDate": "2025-03-01T10:00:00.000Z",
  "prescriptionDate": "2025-02-28T00:00:00.000Z",
  "optometristName": "Dr. Smith",
  "urgency": "RUSH",
  "orderSource": "WEB",
  "deliveryDate": "2025-03-05T00:00:00.000Z",
  "totalAmount": 0,
  "tax": 0,
  "grandTotal": 0,
  "totalQuantity": 0,
  "internalNote": "High-priority job",
  "fileNames": [],
  "adminApproval": false,
  "orderItems": [
    /* see section 4 */
  ]
}
```

For `PATCH /api/v1/orders/:id`, send the same fields inside the body; omitted fields stay unchanged.

---

## 4. Order Item – Prescription & Lens Fields

Each order item captures a full **per-eye prescription** and **lens specification**.

### 4.1 Core prescription fields

All are optional in the API; enforce what you need in the UI.

- **Distance / near Rx per eye**
  - `sphereRight`, `sphereLeft` – SPH
  - `cylinderRight`, `cylinderLeft` – CYL
  - `axisRight`, `axisLeft` – AX (0–180)
  - `addRight`, `addLeft` – ADD
  - `prismRight`, `prismLeft` – PRISM (if present in Rx)

- **PD**
  - `pd` – binocular PD
  - `pdMonocularRight`, `pdMonocularLeft` – monocular PD values

**Addition (ADD)**  
- Prefer **from the doctor’s prescription**: send `addRight`, `addLeft` in diopters (e.g. `2.5` for +2.50 D).  
- If ADD is **not** on the prescription, derive it from the **spare (reading) prescription**:
  - **ADD = close vision power − distance vision power** (same eye).
  - Example: distance vision +1.50, close vision +4.00 → ADD = +4.00 − (+1.50) = **+2.50 D** (often written as 250 in 0.01 steps, e.g. on item bases as +25).
  - Store the result in `addRight` / `addLeft` and use it to select the correct **item base** (e.g. for code 3221, ADD +2.50 → choose the base variant 350^+25 or 575^+25).

### 4.2 Lens parameters

- `lensType` – `"SINGLE_VISION"`, `"BIFOCAL"`, `"PROGRESSIVE"`, etc.
- `lensMaterial` – `"CR-39"`, `"POLYCARBONATE"`, `"PLASTIC"`, `"HI-INDEX_1.67"`, etc.
- `lensCoating` – `"AR"`, `"PHOTO_SOLAR"`, `"PHOTO_SOLAR_ARC"`, etc.
- `lensIndex` – numeric index (e.g. `1.5`, `1.59`, `1.67`)
- `baseCurve` – base curve, numeric
- `diameter` – lens diameter, numeric
- `tintColor` – e.g. `"GRAY"`, `"BROWN"`, `"GREEN"`

When the selected item has **bases** (see §5.3), you can send:

- `itemBaseId?: string` – ID of the chosen variant (e.g. 3221 with base 350 and add +2.5). Omit if the item has no bases or a single variant.

**Services optional (eyeglass item-only)**  
For lens-only order lines you do **not** need to send a service. When the user selects an **item** (and optionally a **base** variant), the system should:

1. **Check pricing and tool** – Call `GET /api/v1/items/:id/order-info?itemBaseId=...` (omit `itemBaseId` if the item has no bases or one variant). The response includes:
   - `item` – the lens blank (with `machine` = required tool)
   - `pricing` – item-only pricing for that item (+ base), or `null` if none is configured
   - `machine` – the machine/tool required for this item

2. **Create the order item** – Send `itemId`, optional `itemBaseId`, `uomId`, `baseUomId` (e.g. from `item.defaultUomId` and `pricing.baseUomId`). You can omit `pricingId`: the backend resolves it from the item (and itemBase). You can omit `serviceId` and `nonStockServiceId` for item-only lines.

Order responses (`GET /api/v1/orders`, `GET /api/v1/orders/:id`) include `orderItems[].item` and `orderItems[].item.machine` so the frontend can show the **tool** per line.

These live alongside the existing ordering fields:

- `itemId`, optional `itemBaseId`, optional `serviceId` / `nonStockServiceId`, `isNonStockService`
- `pricingId` (optional – resolved from item + itemBase when omitted), `uomId`, `baseUomId`
- `quantity`, `unitPrice`, `totalAmount`, `discount`, `level`, `status`, etc.

### 4.3 Example order item in `orderItems[]`

```json
{
  "itemId": "uuid-of-lens-blank-item",
  "serviceId": "uuid-of-lab-service",
  "isNonStockService": false,
  "pricingId": "uuid-of-pricing",
  "uomId": "uuid-of-uom",
  "baseUomId": "uuid-of-base-uom",
  "quantity": 1,
  "unitPrice": 500,
  "totalAmount": 500,
  "level": 1,
  "adminApproval": false,
  "isDiscounted": false,
  "status": "Pending",
  "description": "SV lenses, AR coating",

  "sphereRight": -2.75,
  "cylinderRight": 0.0,
  "axisRight": 130,
  "prismRight": 0.5,

  "sphereLeft": 2.25,
  "cylinderLeft": 0.0,
  "axisLeft": 0,
  "prismLeft": 0.5,

  "addRight": 2.5,
  "addLeft": 2.5,
  "pd": 63,
  "pdMonocularRight": 31.5,
  "pdMonocularLeft": 31.5,

  "lensType": "BIFOCAL",
  "lensMaterial": "PLASTIC",
  "lensCoating": "PHOTO_SOLAR_ARC",
  "lensIndex": 1.5,
  "baseCurve": 4.0,
  "diameter": 70.0,
  "tintColor": "GRAY"
}
```

Usage:

- **Create order**: include objects like this in `orderItems[]` on `POST /api/v1/orders`.
- **Update order item**: send the same fields to `PATCH /api/v1/order-items/:id`.

Backend will persist these values and return them in:

- `GET /api/v1/orders`, `GET /api/v1/orders/:id` → in each `orderItems[]`
- `GET /api/v1/order-items`, `GET /api/v1/order-items/:id`

You can display them in Rx detail views, job tickets, and production UIs.

---

## 5. Item (Lens Blank) Metadata

`Item` entities can carry lens metadata for better selection in the frontend.

### 5.1 New fields on `Item`

- `itemCode?: string` – optional **short code** (e.g. `1113`, `1123`, `3221`, `1311`)
- `lensMaterial?: string`
- `lensIndex?: number`
- `lensType?: string`

### 5.2 Material bases (itemCode with base^add variants)

Some materials have **multiple bases** per item code, e.g.:

- **3221** (Progressi plastic solar): `350^+25`, `575^+25` (base 350 or 575, add +2.50 D)
- **1311**: `400^+25`, `600^+25`, `800^+75`, `1000^+75` (bases 400/600/800/1000 with add +2.50 or +7.50 D)

The API models this with an **ItemBase** entity per variant:

- `id` – UUID
- `itemId` – parent item
- `baseCode` – e.g. `"350"`, `"575"`, `"400"`, `"600"`, `"800"`, `"1000"`
- `addPower` – add power in diopters (e.g. `2.5`, `7.5`)

**Endpoints:**

- `GET /api/v1/items/:id` – item response includes `itemBases[]` when present (optional relation).
- `GET /api/v1/items/:id/bases` – returns the list of bases for that item (e.g. for dropdown when creating an order line).
- `GET /api/v1/items/:id/order-info?itemBaseId=...` – when the user selects an item for an order line, returns **pricing** (item-only for that item and base) and **tool** (`machine`). Use this to check pricing and required machine before creating the order item.

When creating or updating an **order item** for an item that has bases, send `itemBaseId` with the chosen variant’s ID. Order item responses include an `itemBase` object when set (with `baseCode`, `addPower`).

### 5.3 Example item payload

```json
{
  "itemCode": "1123",
  "name": "SV Polycarbonate 1.59",
  "description": "Single vision polycarbonate blank",
  "reorder_level": 50,
  "initial_stock": 200,
  "updated_initial_stock": 200,
  "machineId": "uuid-of-machine",
  "quantity": 200,
  "unitCategoryId": "uuid-of-unit-category",
  "defaultUomId": "uuid-of-pair-uom",
  "purchaseUomId": "uuid-of-pair-uom",

  "lensMaterial": "POLYCARBONATE",
  "lensIndex": 1.59,
  "lensType": "SINGLE_VISION"
}
```

On reads (`GET /api/v1/items` / `/items/:id`), use these to:

- Group items in dropdowns by material / index / type.
- Show or search by `itemCode` (e.g. printed codes like `1113`, `1123`, `3221`, `1311`).
- Auto-fill some defaults when the user selects a lens blank for an order item.
- If the item has `itemBases`, show a second dropdown (or list) so the user picks the base variant (e.g. 350^+2.5); then send `itemBaseId` on the order item.

---

## 6. Backwards Compatibility

- All eyeglass‑specific properties are **optional**.
- Any existing client that does **not** send these new fields can continue to:
  - Create customers, items, orders, order items as before.
  - Ignore eyeglass fields in the responses.

Recommended rollout:

1. Show new fields in **read‑only** views (order details, job tickets).
2. Add them to **create/edit** forms in the frontend.
3. Add frontend‑side validation (e.g. SPH range, AX 0–180, etc.) once the workflows are stable.

