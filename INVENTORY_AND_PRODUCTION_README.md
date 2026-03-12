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

Backend rules:

- To move an item to **`InProgress`**, `approvalStatus` must be `"Approved"`.
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

## 4. End‑to‑end flow to complete an order

For each order item:

1. **Order received**
   - `status = "Pending"`, `approvalStatus` and `qualityControlStatus` default to `"Pending"`.

2. **Approval**
   - Approver/supervisor reviews the line and sets `approvalStatus = "Approved"`.
   - Without this, the backend rejects attempts to move `status` to `"InProgress"`.

3. **Store issues material**
   - Lab technician or system raises a **store request** for the items needed for the lens.
   - Store person checks `Item.quantity` and, if sufficient, **stocks out** the items to the lab (standard inventory flow).

4. **Start production**
   - Lab technician calls `PATCH /api/v1/order-items/:id` with `status = "InProgress"` (and any other updates).
   - Backend checks:
     - `approvalStatus === "Approved"` (required).
     - Does **not** perform stock checks here; assumes the store already issued items.

5. **Finish production**
   - When the lens is ready, lab sets `status = "Ready"`.

6. **Quality control**
   - QC process updates `qualityControlStatus` to:
     - `"Passed"` if the lens meets standards, or
     - `"Failed"` if it does not (item must be remade).

7. **Delivery**
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

