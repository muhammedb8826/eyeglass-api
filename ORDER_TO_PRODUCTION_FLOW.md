# Order to Production Flow – What’s Done and What Remains

This describes the steps from **order creation** to **producing the lenses** and what the system already does vs what you may still want to add.

---

## Current flow (already in the system)

### 1. Create/update order

- **POST /api/v1/orders** or **PATCH /api/v1/orders/:id**
- Backend:
  - Resolves pricing, calculates cost/sales and order totals.
  - **Lab tools:** If any order item has a `baseCurve`, it checks that at least one lab tool covers that base curve with `quantity > 0`. If not, the request fails with a clear error so the order cannot be “produced” later without the right tools.

### 2. Order item statuses (lifecycle)

Each **order item** has a `status`. The **order** status is derived from its items (e.g. all items “Printed” → order “Printed”).

| Item status   | Meaning (typical use) | What the backend does |
|---------------|------------------------|------------------------|
| **Received**  | Item received / ready for lab | — |
| **Printed**   | Sent to production / “print” | For **stock** items: reduces **operator stock** by `unit`, records **bincard** OUT. Requires operator stock to exist and be sufficient; otherwise 409 Conflict. |
| **Completed** | Lens production done | — |
| **Delivered** | Delivered to customer | If payment term has `forcePayment` and `remainingAmount > 0`, blocks with 409. |
| **Void**      | Cancelled | Same stock reduction as Printed (stock is consumed). |

- **Update item status:** **PATCH /api/v1/order-items/:id** with body `{ "status": "Printed", ... }` (and other fields as needed).

### 3. What “producing the lenses” means in code

- **Physically**, production is represented by moving each order item to **Printed** (and then Completed/Delivered as you use them).
- **Before an item can go to Printed:**
  1. **Operator stock** must exist for that item and be ≥ `orderItem.unit`, or the PATCH fails.
  2. **Lab tools** are only checked at **order create/update**, not again when moving to Printed (see “Remaining” below).

So **to complete the order and produce the lenses** in the current system you:

1. Create/update the order (pricing + lab tool check already done).
2. Ensure **operator stock** is available for each lens item (request/stock flow that fills `operator_stock`).
3. For each order item, call **PATCH /api/v1/order-items/:id** and set **status** to **Printed** when you actually start production (stock is then reduced and bincard recorded).
4. Optionally move to **Completed** when the lens is made, then **Delivered** when handed to the customer (with payment check if `forcePayment` is on).

---

## What remains (optional improvements)

These are not required for the basic “order → produce lenses” path but close gaps if you want stricter production logic.

| # | Item | Description |
|---|------|-------------|
| 1 | **Lab tool check at “Printed”** | Right now lab tools are only checked when the order is created/updated. If an item has `baseCurve`, you could **re-check** (and optionally **decrement**) lab tool availability when its status changes to **Printed**, so you never “print” without a tool. |
| 2 | **Lab tool reservation/decrement** | The system only checks that a tool *exists* with quantity > 0; it does not reserve or decrement. You could decrement (or reserve) the matching lab tool when status → Printed and restore when status is reverted from Printed/Void. |
| 3 | **“Can produce” endpoint** | A **GET /api/v1/orders/:id/can-produce** (or similar) that returns whether the order is ready for production: e.g. all items have operator stock ≥ required, all base curves have an available lab tool, and optionally payment OK. Frontend can call this before showing “Print” / “Produce”. |
| 4 | **Documentation for frontend** | Expose this flow in your frontend docs (statuses, PATCH order-items, operator stock requirement, and that “Printed” = start production and consumes stock). |

---

## Summary

- **To complete the order and produce the lenses today:**  
  Create/update order (pricing + lab tools validated) → ensure operator stock for each item → set each order item to **Printed** via **PATCH /api/v1/order-items/:id** (stock is reduced and bincard updated) → then **Completed** / **Delivered** as needed.
- **Remaining (optional):** Re-check and/or reserve/decrement lab tools at “Printed”, add a “can produce” endpoint, and document the flow for the frontend.
