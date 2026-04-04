# Eyeglass Lens API – Frontend Integration Guide

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
- `qualityControlStatus` – per-line QC (`"Pending"`, `"Passed"`, `"Failed"`). Delivery requires `"Passed"`. Sending **`"Failed"`** once (when the line was not already failed) **triggers a remake**: **`status: "Pending"`**, **`approvalStatus: "Approved"`**, **`qualityControlStatus: "Pending"`**. Include **`operatorId`** in the same PATCH to also set **`storeRequestStatus: "Requested"`** and **create a new Sale / store request** (each QC fail + `operatorId` = another Sale — e.g. five fails → five requests). Without **`operatorId`**, **`storeRequestStatus`** becomes **`"None"`**; then **`None` → `Requested`** with **`operatorId`** creates the next Sale. Use **order item notes** to record why QC failed.
- `storeRequestStatus` – per-line store request/issue (`"None"`, `"Requested"`, `"Issued"`). Production (`status = "InProgress"`) is blocked until the store has issued materials and this becomes `"Issued"`.
- **Editing locked lines:** once `approvalStatus` is `"Approved"`, or the line `status` is `"InProgress"` / `"Ready"`, or the **order** `status` is `"InProgress"` / `"Ready"`, you must not change prescription, lens fields, quantities, pricing, item/base, etc. Only workflow fields are accepted on `PATCH /order-items/:id` (and on nested `orderItems` in `PATCH /orders/:id`): `storeRequestStatus`, `operatorId`, `status`, `qualityControlStatus`, `approvalStatus`, `adminApproval`, `orderId` (unchanged).

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

---

## 7. Variant Inventory (Important Frontend Update)

Stock is now tracked using an **industry-standard lens model**:

- If an item has `itemBases[]`, stock is managed **per variant** (`itemBaseId`), not only at parent item level.
- `ItemBase.quantity` is the source of truth for lens stock.
- Parent `Item.quantity` is maintained by backend as a sum/aggregate for convenience.

### 7.1 How frontend should decide `itemBaseId`

For any line that moves stock (store request issue/sale, purchase receipt):

1. Load item details (`GET /api/v1/items/:id` or `GET /api/v1/items/:id/bases`).
2. If `itemBases.length > 0`, **require user to pick a base variant** and send `itemBaseId`.
3. If `itemBases.length === 0`, **do not send `itemBaseId`**.

Backend validation now enforces this strictly.

### 7.2 Sales / Store Request payload requirement

When creating/updating sales (`POST/PATCH /api/v1/sales`) and sale items:

- For variant-tracked item: `saleItems[].itemBaseId` is required.
- For non-variant item: `saleItems[].itemBaseId` must be omitted or null.

Example sale line for a variant-tracked lens:

```json
{
  "itemId": "uuid-material-3221",
  "itemBaseId": "uuid-base-350-add-25",
  "uomId": "uuid-uom",
  "baseUomId": "uuid-base-uom",
  "quantity": 2,
  "unit": 2,
  "status": "Requested"
}
```

Status behavior for inventory movement:

- `Requested`: availability is checked against the selected variant.
- Transition to `Stocked-out`: stock is reduced (OUT movement).
- Transition from `Stocked-out` to another status (or deleting a stocked-out line): stock is returned (IN movement).

### 7.3 Purchases payload requirement

When creating/updating purchase items:

- For variant-tracked item: `itemBaseId` is required.
- For non-variant item: `itemBaseId` must be omitted/null.

Example purchase item line:

```json
{
  "purchaseId": "uuid-purchase",
  "itemId": "uuid-material-3221",
  "itemBaseId": "uuid-base-575-add-25",
  "uomId": "uuid-uom",
  "baseUomId": "uuid-base-uom",
  "quantity": 50,
  "unit": 50,
  "unitPrice": 120,
  "amount": 6000,
  "status": "Pending"
}
```

Status behavior for inventory movement:

- Transition to `Received`: stock is increased (IN movement).
- Transition from `Received` to another status (or deleting a received line): stock is reversed (OUT movement).

### 7.4 Bincard behavior

Bincard entries now optionally include `itemBaseId`:

- If `itemBaseId` is set, `balanceAfter` represents that variant balance.
- If `itemBaseId` is null, `balanceAfter` represents parent item balance (legacy/non-variant).

Frontend recommendation:

- In stock history screens, display both:
  - material (`itemId` / item name)
  - variant (from `itemBaseId` -> `baseCode` + `addPower`) when available

### 7.5 Store request from order item

Automatic store requests created from order items now propagate `orderItem.itemBaseId` (for non-BOM material requests).  
This means lab/store flows should preserve correct variant tracking without extra manual correction.

### 7.6 Error messages you may receive

Expect and handle these as validation/business errors:

- `itemBaseId is required for "<item>" because stock is tracked per base/ADD variant.`
- `This item does not use base/ADD variants; omit itemBaseId...`
- `itemBaseId does not belong to this item or was not found.`
- `Requested quantity exceeds available stock for this variant...`
- `Insufficient stock at this base/ADD variant.`

### 7.7 UI checklist for rollout

- Add variant selector (`itemBaseId`) in:
  - order item forms (already recommended in section 4/5),
  - sale/store request item forms,
  - purchase item forms.
- Make selector conditionally required only when item has bases.
- Show variant stock (`ItemBase.quantity`) in dropdown options to prevent wrong picks.
- For existing historical rows where `itemBaseId` is missing on variant items, show a warning badge and prevent issuing/receiving until corrected.

---

## 8. RBAC (Roles) + User Activation/Deactivation

This backend uses:

- **JWT auth** for all endpoints (unless explicitly marked public).
- **RBAC** via `roles` on the user.
- **Permissions** (industry-style `resource.action` codes) assigned **per role** in the database.
- **ADMIN** is a superuser: effective **full access** to all permissions (not stored row-by-row).

### 8.1 Roles

Users have a single `roles` value (enum):

- `ADMIN` — full access
- `FINANCE` — purchases, payments, finance masters, reporting
- `SALES` — customers, orders, order lines, store requests / sales documents
- `CASHIER` — checkout: customers, orders, order lines, payment-related reads
- `PRODUCTION` — lab: move lines through **InProgress** / **Ready** (requires `production.write`)
- `STORE_KEEPER` — stock: sales/store fulfillment, purchases receipt, operator stock, bincard
- `QUALITY_CONTROL` — set line **qualityControlStatus** (requires `quality_control.write`)

**Self-signup** (`POST /signup`) assigns role **`CASHIER`** unless an admin changes it.

Use `roles` for coarse UI grouping; use **permissions** (below) for accurate menu/route guards.

### 8.2 Server-side enforcement

The API applies a **global permission guard** after JWT authentication:

- For most routes, an authenticated user must hold the permission(s) declared on that route (via `@RequirePermissions` in the backend). If they do not, the response is **403** with `Missing permission: <code>`.
- Some routes are **public** (no JWT): e.g. `POST /signin`, `POST /signup`, `POST /refresh`, `POST /contact`, and **read-only** `GET /pricing` listings (and similar explicitly marked handlers).
- Some routes require a valid JWT but **do not** check the permission matrix (intentional “any signed-in user”): e.g. **`GET /permissions`**, **`GET /permissions/me`**, **`/account/*`**, **`/notifications/*`**, and **auth** helpers like **`POST /logout`**. The frontend should still use `permissions/me` to hide UI; the API only skips the matrix on these paths.

If a route is authenticated but the backend forgot to declare a permission (and it is not public/skip), the API responds with **403** and a message that the route must be assigned permissions or marked public/skip — that indicates a server configuration bug, not a missing role grant.

**Order line PATCH (`PATCH /order-items/:id`):** the route allows **any of** `order_items.write`, `production.write`, or `quality_control.write` past the guard, but the service then requires the **right** permission(s) for the fields you change (AND when multiple kinds of change are sent). For example, moving a line to **InProgress** / **Ready** needs `production.write`; changing **qualityControlStatus** needs `quality_control.write`; approval, store request, delivery, and structural fields need `order_items.write`.

### 8.3 Permission codes (`resource.action`)

Codes used by the API (non-exhaustive; `GET /permissions` returns the full catalog):

- `users.manage` — user CRUD, activate/deactivate, reset password
- `permissions.manage` — view/edit which permissions each role has (`/permissions/matrix`, `PUT /permissions/roles/...`, etc.)
- `orders.read` / `orders.write`
- `order_items.read` / `order_items.write`
- `production.write` — order line status in the lab (**InProgress**, **Ready**, and related transitions)
- `quality_control.write` — order line `qualityControlStatus` (**Passed** / **Failed** / **Pending**)
- `customers.read` / `customers.write`
- `items.read` / `items.write`
- `purchases.read` / `purchases.write`
- `sales.read` / `sales.write`
- `bincard.read`
- `pricing.read` / `pricing.write` (mutations use `pricing.write`; some pricing **GET** routes are public — see API)
- `vendors.read` / `vendors.write`
- `master.read` / `master.write` — shared master data (machines, services, UOM, unit categories, sales partners, non-stock services, user–machine assignments)
- `bom.read` / `bom.write`
- `lab_tool.read` / `lab_tool.write`
- `finance.read` / `finance.write` — discounts, commissions, commission transactions, payment terms, payment transactions, fixed costs
- `stock_ops.read` / `stock_ops.write` — operator stock
- `file.write` — `POST /file/upload`

On first database bootstrap, the server seeds the **permission catalog** and a **default role → permission matrix** (you can change non-`ADMIN` roles later via API). **Existing databases** do not automatically re-sync when defaults change in code; adjust roles with **`PUT /permissions/roles/:role`** (or migrate) if you need new codes on a role.

### 8.4 APIs for the frontend

- **Current user’s effective permissions** (recommended for menus):

  `GET /api/v1/permissions/me`

  Response shape:

  ```json
  { "role": "PRODUCTION", "permissions": ["items.read", "orders.read", ...] }
  ```

- **Full catalog** (labels / admin UI):

  `GET /api/v1/permissions`

- **Full matrix** (admin):

  `GET /api/v1/permissions/matrix`  
  Requires `permissions.manage` (or `ADMIN`).

- **Replace permissions for one role** (admin):

  `PUT /api/v1/permissions/roles/:role`  
  Body: `{ "codes": ["orders.read", "orders.write"] }`  
  Use `{ "codes": [] }` to **clear** all permissions for that role (non-`ADMIN` only).  
  Requires `permissions.manage` (or `ADMIN`).  
  **Note:** You cannot assign explicit permissions to `ADMIN`; `ADMIN` always has full access.

If the user lacks a required permission, protected endpoints respond with **403** and a message like `Missing permission: users.manage`.

### 8.5 User management (`users.manage`)

All `/api/v1/users/*` endpoints require the **`users.manage`** permission.

- Users with role **`ADMIN`** always satisfy this (superuser).
- Other roles only if an admin has granted `users.manage` to that role via `PUT /permissions/roles/...` (unusual).

### 8.6 Activate / deactivate user accounts

Industry-standard behavior: deactivated users cannot sign in or access protected APIs.

Endpoints (require `users.manage` or `ADMIN`):

- **Activate**
  - `PATCH /api/v1/users/:id/activate`
- **Deactivate**
  - `PATCH /api/v1/users/:id/deactivate`

Admin account safety:

- The `ADMIN` account cannot be deactivated or deleted.

Example deactivate request:

```http
PATCH /api/v1/users/USER_UUID/deactivate
Authorization: Bearer <accessToken>
```

### 8.7 What happens when a user is deactivated

- `POST /api/v1/signin` fails with: `Account is deactivated`
- `POST /api/v1/refresh` fails with: `Account is deactivated`
- Any protected endpoint using an access token fails with: `Account is inactive or does not exist`

Frontend checklist:

- If you receive any of the above, clear local tokens and redirect to login.
- In admin UI, show a toggle/button for active status and reflect `is_active`.

---

## 9. In-App Notifications

The API supports **in-app notifications** stored in the database and scoped per user (recipient = signed-in user).

All endpoints require:

- `Authorization: Bearer <accessToken>`

They do **not** require a specific permission code beyond being signed in (same pattern as `/account`).

### 9.1 List notifications

`GET /api/v1/notifications?page=1&limit=20&status=all`

Query params:

- `page` (default 1)
- `limit` (default 20, max 100)
- `status` = `all` | `unread` | `read`

Response `data` shape:

```json
{
  "items": [
    {
      "id": "uuid",
      "recipientId": "uuid",
      "type": "STORE_REQUEST",
      "title": "New store request created",
      "message": "Store request SR-... was created for order ...",
      "data": { "saleSeries": "SR-...", "orderItemId": "uuid" },
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-04-02T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 9.2 Unread count (badge)

`GET /api/v1/notifications/unread-count`

Returns:

```json
{ "unread": 5 }
```

### 9.3 Mark one notification as read

`PATCH /api/v1/notifications/:id/read`

### 9.4 Mark all notifications as read

`PATCH /api/v1/notifications/read-all`

### 9.5 Delete a notification

`DELETE /api/v1/notifications/:id`

### 9.6 Notifications emitted by the backend (current)

- **User activation/deactivation**
  - When an admin activates or deactivates a user, the target user receives a `SECURITY` notification.
- **Store request created**
  - When an order item triggers an automatic store request, the assigned `operatorId` receives a `STORE_REQUEST` notification.
