## Eyeglass Inventory & Production Flow – Lab vs Store

This document describes how **inventory** and **production** now work after removing `operator_stock` and introducing per-item **approval** and **quality control**.

---

## 1. Roles and responsibilities

- **Store / inventory**
  - Owns all physical stock (main warehouse / store).
  - Performs all **stock-out** (issues to lab) and **stock-in** (returns, adjustments) via standard inventory modules (purchases, sales, bincard, etc.).
  - Is the only source of truth for on-hand quantity (`Item.quantity`).

- **Lab technician**
  - Does **not** manage independent “operator stock”.
  - Can **only start production** after the store has issued the required items.
  - Updates order items through their lifecycle (`Pending → InProgress → Ready → Delivered`) and maintains QC status.

- **Approver / supervisor**
  - Reviews each order item and sets `approvalStatus = "Approved"` before production can start.

---

## 2. Order item fields (recap)

Each order line (`OrderItems`) includes:

- **Status workflow**
  - `status: "Pending" | "InProgress" | "Ready" | "Delivered" | "Cancelled"`
- **Approval**
  - `approvalStatus: string` (typically `"Pending"` / `"Approved"` / `"Rejected"`)
- **Quality control (QC)**
  - `qualityControlStatus: "Pending" | "Passed" | "Failed"`
 - **Store request / issue**
   - `storeRequestStatus: "None" | "Requested" | "Issued"` – tracks whether a **store request** has been created and the **stock-out** has been completed for this line.

Backend rules:

- To move an item to **`InProgress`**, BOTH must be true:
  - `approvalStatus === "Approved"`, and  
  - `storeRequestStatus === "Issued"` (ensures the store has already stocked out the required items, either from BOM components or, when no BOM exists, from the ordered item itself).  
  If these conditions are not met, the backend returns a `409 Conflict` when you try to set `status = "InProgress"`.
- To move an item to **`Delivered`**, `qualityControlStatus` must be `"Passed"` and payment rules (e.g. `forcePayment`) must be satisfied.

The **order** status is derived from its items:

- All `Pending` → order `Pending`
- All `InProgress` → order `InProgress`
- All `Ready` → order `Ready`
- All `Delivered` → order `Delivered`
- Mixed → order `Processing`

---

## 3. Inventory model (no `operator_stock`)

### 3.1 What was removed

- The `operator_stock` table and its usage have been removed from:
  - Order item updates (no more stock checks or movements on status change).
  - Sale item flows (no more mirroring stock into operator stock).
  - Item/UOM relations (`Item` and `UOM` no longer reference `OperatorStock`).
  - Application module wiring (`OperatorStockModule` is no longer imported).

### 3.2 How stock now flows

All stock movements are handled by the **store**:

1. **Purchase / initial stock**
   - Increases `Item.quantity` via purchase flows or opening balances.
2. **Store issues to lab (for production)**
   - The lab technician requests items for a job.
   - Store person **stocks out** from main inventory to the lab using standard inventory actions (e.g. a “store issue” or “internal sale” concept).
   - This reduces `Item.quantity` and is recorded in bincard / inventory.
3. **Returns / adjustments (optional)**
   - If unused items are sent back or errors occur, store processes the return as a normal inventory adjustment or return; again only `Item.quantity` and bincard are updated.

There is **no separate buffer** for operator stock; the system relies strictly on:

- `Item.quantity` for available stock, and
- store-issued transactions to represent movement from store to lab.

---

## 4. End‑to‑end flow to complete an order (with automatic store requests)

For each order item:

1. **Order received**
   - `status = "Pending"`, `approvalStatus` and `qualityControlStatus` default to `"Pending"`.

2. **Approval**
   - Approver/supervisor reviews the line and sets `approvalStatus = "Approved"`.
   - Without this, the backend rejects attempts to move `status` to `"InProgress"`.

3. **Store request (automatic)**
   - In the Notifications/Approved view, the lab technician clicks **Request items from store** for a line.
   - Frontend calls:
     - `PATCH /api/v1/order-items/:id` with:
       - `storeRequestStatus = "Requested"`
       - `operatorId = "<lab-operator-or-store-user-id>"`
   - Backend behaviour in `OrderItemsService.update`:
     - Detects transition `storeRequestStatus: "None" → "Requested"`.
     - Automatically creates a **Sale** (internal store request) with:
       - `series` like `SR-<order.series>-<timestamp>`
       - `operatorId` from the payload
       - `status = "Requested"`
       - `totalQuantity` = the order item’s total quantity.
     - Creates **SaleItems** for the request:
       - If the item has a **BOM** (`item.bomLines`):
         - For each BOM component:
           - `itemId = bom.componentItemId`
           - `uomId = bom.uomId`, `baseUomId = bom.uomId`
           - `unit = quantity = bom.quantity × orderItem.quantity`
           - `status = "Requested"`.
       - If the item has **no BOM**:
         - A single `SaleItem`:
           - `itemId = orderItem.itemId`
           - `uomId = orderItem.uomId`, `baseUomId = orderItem.baseUomId`
           - `unit = quantity = orderItem.quantity`
           - `status = "Requested"`.

4. **Store issues material**
   - Store user processes the created **Sale** (store request) and, per line, sets:
     - `status = "Stocked-out"` on the corresponding `SaleItems`.
   - This:
     - Decreases `Item.quantity` by `saleItem.unit`.
     - Writes a **SALE / OUT** entry in `bincard` (see §6.2).
   - Once store has issued items, the UI (or a dedicated backend process) should set the order item’s:
     - `storeRequestStatus = "Issued"`.

5. **Start production**
   - Lab technician calls `PATCH /api/v1/order-items/:id` with `status = "InProgress"` (and any other updates).
   - Backend checks:
     - `approvalStatus === "Approved"` (required).
     - `storeRequestStatus === "Issued"` (required – enforces that store has stocked out the items).

6. **Finish production**
   - When the lens is ready, lab sets `status = "Ready"`.

7. **Quality control**
   - QC process updates `qualityControlStatus` to:
     - `"Passed"` if the lens meets standards, or
     - `"Failed"` if it does not (item must be remade).

8. **Delivery**
   - To deliver, lab/desk sets `status = "Delivered"`.
   - Backend enforces:
     - `qualityControlStatus === "Passed"`.
     - Payment rules (e.g. `forcePayment` implies `remainingAmount == 0`).

When **all** items are `Delivered`, the order automatically becomes `Delivered`. If any item is in another status, the order is `Processing`.

---

## 5. Frontend notes

- Only the **store/inventory UI** should manipulate stock; lab UIs should:
  - Show current `Item.quantity` (read‑only).
  - Drive status changes (`Pending → InProgress → Ready → Delivered`) and QC/approval fields.
- To check if an order is “ready to start production”, a future `GET /api/v1/orders/:id/can-produce` endpoint can:
  - Verify all items are **approved**.
  - Optionally confirm required store issues exist for the items.
  - Ensure lab tool and payment conditions are satisfied.

---

## 6. Bincard behavior (purchases and store issues)

### 6.1 Purchases (`PurchaseItems`)

When a **purchase item** status changes via `PATCH /api/v1/purchase-items/:id`:

- `status = "Received"`:
  - Increases `Item.quantity` by `purchaseItem.unit`.
  - Writes a bincard entry:
    - `movementType = "IN"`
    - `referenceType = "PURCHASE"`
    - `referenceId = purchaseItem.purchaseId`
    - `quantity = purchaseItem.unit`
    - `balanceAfter = new stock quantity`
    - `uomId = purchaseItem.uomId`

- `status = "Cancelled"`:
  - Decreases `Item.quantity` by `purchaseItem.unit`.
  - Writes a bincard entry:
    - `movementType = "OUT"`
    - `referenceType = "PURCHASE"`
    - `referenceId = purchaseItem.purchaseId`
    - `quantity = purchaseItem.unit`
    - `balanceAfter = new stock quantity`

### 6.2 Store issues to lab (`SaleItems`)

When the store processes a **store request / internal issue** via `PATCH /api/v1/sale-items/:id`:

- `status = "Stocked-out"` (issue to lab for production or sale):
  - Decreases `Item.quantity` by `saleItem.unit`.
  - Writes a bincard entry:
    - `movementType = "OUT"`
    - `referenceType = "SALE"`
    - `referenceId = saleItem.saleId`
    - `quantity = saleItem.unit`
    - `balanceAfter = new stock quantity`

- `status = "Cancelled"` (issue reversed, stock returned):
  - Increases `Item.quantity` by `saleItem.unit`.
  - Writes a bincard entry:
    - `movementType = "IN"`
    - `referenceType = "SALE"`
    - `referenceId = saleItem.saleId`
    - `quantity = saleItem.unit`
    - `balanceAfter = new stock quantity`

This ensures every **stock-in (purchase/return)** and **stock-out (issue to lab or sale)** is reflected both in `Item.quantity` and in the `bincard` history.

