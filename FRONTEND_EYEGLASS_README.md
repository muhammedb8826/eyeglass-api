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
  "series": "NDS-2026-0001",
  "customerId": "uuid-of-customer",
  "status": "Pending",
  "orderDate": "2025-03-01T10:00:00.000Z",
  "prescriptionDate": "2025-02-28T00:00:00.000Z",
  "optometristName": "Dr. Smith",
  "urgency": "RUSH",
  "orderSource": "WEB",
  "deliveryDate": "2025-03-05T00:00:00.000Z",
  "totalAmount": 0,
  "grandTotal": 0,
  "totalQuantity": 0,
  "internalNote": "High-priority job",
  "adminApproval": false,
  "orderItems": [
    /* see section 4 */
  ]
}
```

Orders do **not** use a separate tax or VAT field. After items are saved, the API recalculates `totalAmount` and `grandTotal` from line `totalAmount` values (they match; no tax is added).

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

1. **Check pricing** – Call `GET /api/v1/items/:id/order-info?itemBaseId=...` (omit `itemBaseId` if the item has no bases or one variant). The response includes:
   - `item` – the lens blank
   - `pricing` – item-only pricing for that item (+ base), or `null` if none is configured

2. **Create the order item** – Send `itemId`, optional `itemBaseId`, `uomId`, `baseUomId` (e.g. from `item.defaultUomId` and `pricing.baseUomId`). You can omit `pricingId`: the backend resolves it from the item (and itemBase). You can omit `serviceId` and `nonStockServiceId` for item-only lines.

Order responses (`GET /api/v1/orders`, `GET /api/v1/orders/:id`) include `orderItems[].item` so the frontend can show the lens blank per line.

These live alongside the existing ordering fields:

- `itemId`, optional `itemBaseId`, optional `serviceId` / `nonStockServiceId`, `isNonStockService`
- `pricingId` (optional – resolved from item + itemBase when omitted), `uomId`, `baseUomId`
- **Quantity (updated – per eye):** Right and left lenses can be produced separately. Send **`quantityRight`** and/or **`quantityLeft`** for per-eye quantities; the backend sets **`quantity`** = `quantityRight + quantityLeft`. If you only send **`quantity`** (legacy), it is treated as right-eye only (`quantityRight = quantity`, `quantityLeft = 0`). Order totals use the total `quantity`.
- `unitPrice`, `totalAmount`, `discount`, `level`, `status` (eyeglass standard: **Pending** → **InProgress** → **Ready** → **Delivered**; or **Cancelled**), etc.
- `approvalStatus` – per-line approval (string, e.g. `"Approved"`).
- `qualityControlStatus` – per-line QC (`"Pending"`, `"Passed"`, `"Failed"`). When `"Failed"`, the backend blocks status changes to `"Delivered"` so the lens must be remade and QC passed first.
- `storeRequestStatus` – per-line store request/issue (`"None"`, `"Requested"`, `"Issued"`). Production (`status = "InProgress"`) is blocked until the store has issued materials and this becomes `"Issued"`.

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
  "quantityRight": 1,
  "quantityLeft": 1,
  "unitPrice": 500,
  "totalAmount": 500,
  "level": 1,
  "adminApproval": false,
  "isDiscounted": false,
  "approvalStatus": "Pending",
  "qualityControlStatus": "Pending",
  "storeRequestStatus": "None",
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

### 4.3.1 Store request (automatic) before production

To enforce industry-standard inventory flow (store issues materials before production):

1. **Request items from store** (lab technician / approved tab)
   - Call `PATCH /api/v1/order-items/:id` with:
     - `storeRequestStatus = "Requested"`
     - `operatorId = "<lab-tech-or-store-user-id>"`
   - Backend automatically creates an internal **Sale** + **SaleItems** as the store request.
     - If the item has **BOM**, the request is for BOM components (\(bom.quantity \times orderItem.quantity\)).
     - If no BOM, the request is for the ordered item itself (quantity = order item quantity).

2. **Store issues** the request
   - Store sets the created `SaleItems.status = "Stocked-out"` in the store UI.
   - When all linked sale items are stocked out, backend auto-updates the order item:
     - `storeRequestStatus = "Issued"`

3. **Start production**
   - Only after `approvalStatus = "Approved"` and `storeRequestStatus = "Issued"` should the UI set:
     - `status = "InProgress"`

Backend will persist these values and return them in:

- `GET /api/v1/orders`, `GET /api/v1/orders/:id` → in each `orderItems[]`
- `GET /api/v1/order-items`, `GET /api/v1/order-items/:id`

You can display them in Rx detail views, job tickets, and production UIs.

### 4.4 Lab tools – automatic check from Rx + base

For items that have **bases** (see §5.2) and a prescription on the order item, the backend automatically checks that the lab has the right **tool blocks** before it accepts the order.

For each order item with:

- a chosen `itemBaseId` (e.g. 350+25, 575+25, 400+25, 800+75), and
- Rx fields (`sphereRight/Left`, `cylinderRight/Left`),

the backend computes tool values as:

- Right eye  
  - `R_SPH_val = Base + R_SPH`  
  - `R_CYL_val = R_SPH_val + R_CYL`
- Left eye  
  - `L_SPH_val = Base + L_SPH`  
  - `L_CYL_val = L_SPH_val + L_CYL`

Where:

- **Base** comes from `ItemBase.baseCode` (e.g. `"350"` → 3.50 D).  
- SPH / CYL are in diopters as sent in the Rx fields.

These four values (where present) are converted to the **tool scale** (100× diopters, e.g. 1.25 D → 125) and checked against the `lab-tools` table. If **any** value has no matching lab tool (range) with `quantity > 0`, the order **POST/PATCH** fails with:

> `Cannot produce order: no lab tool available for calculated base/tool value(s) ...`

The frontend **does not need to send any extra fields** for this check:

- Just send `itemId`, optional `itemBaseId`, and Rx (SPH/CYL).  
- The backend does the Rx + base calculation and tool validation automatically.

---

## 5. Item (Lens Blank) Metadata

`Item` entities can carry minimal metadata for better selection in the frontend.

### 5.1 New fields on `Item`

- `itemCode?: string` – optional **short code** (e.g. `1113`, `1123`, `3221`, `1311`)

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
- `GET /api/v1/items/:id/order-info?itemBaseId=...` – when the user selects an item for an order line, returns **pricing** (item-only for that item and base). Use this to check pricing before creating the order item.

When creating or updating an **order item** for an item that has bases, send `itemBaseId` with the chosen variant’s ID. Order item responses include an `itemBase` object when set (with `baseCode`, `addPower`).

### 5.3 Example item payload

```json
{
  "itemCode": "1123",
  "name": "SV Polycarbonate 1.59",
  "description": "Single vision polycarbonate blank",
  "reorder_level": 50,
  "quantity": 200,
  "unitCategoryId": "uuid-of-unit-category",
  "defaultUomId": "uuid-of-pair-uom",
  "purchaseUomId": "uuid-of-pair-uom"
}
```

On reads (`GET /api/v1/items` / `/items/:id`), use these to:

- Show or search by `itemCode` (e.g. printed codes like `1113`, `1123`, `3221`, `1311`).
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

