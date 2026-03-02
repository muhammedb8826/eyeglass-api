# Item Bases – Industry & How to Add Them

This doc explains **what “base” means in the eyeglass industry**, how it’s stored in this system, and **how to add a base for every item** (e.g. 3221 with 350+25 & 575+25, 1322 with 400+25, 600+25, 800+75, 1000+75).

---

## 1. How the industry works

### What is a “base”?

- Each **lens material/product** (item code, e.g. 3221, 1322) is often supplied in several **semi-finished variants**. Each variant is identified by a **base** (e.g. 350, 575, 400, 600, 800, 1000) and an **add power** (e.g. +2.50 D, +7.50 D).
- **Notation you see:** `350+25` means base **350** and add **+2.50 D** (25 in 0.25 steps). `800+75` means base **800**, add **+7.50 D**.
- **Base** = front curve / semi-finished blank designation (supplier-specific numbering).  
- **Add power** = reading addition (for progressives/bifocals) in diopters. Stored in the system as **diopters** (e.g. `2.5`, `7.5`).

So “every item has its own base” means: **each item (product code) has a list of (baseCode, addPower) pairs** – the variants you can order for that product.

### Examples (industry-style)

| Item code | Product name              | Bases (base + add)                          |
|-----------|---------------------------|---------------------------------------------|
| 3221      | Progressive plastic photosolar | 350+25, 575+25                          |
| 1322      | SV plastic white         | 400+25, 600+25, 800+75, 1000+75            |

The lab chooses the **right base** for the prescription (mainly from the patient’s **ADD** and sometimes distance power). Common rule: **ADD &gt; 1.75 D → use the largest base in the list; otherwise use the smallest** (you can refine this per supplier).

---

## 2. How it’s implemented in this system

- **Entity:** `ItemBase`  
  - `itemId` – parent item (e.g. 3221, 1322)  
  - `baseCode` – string, e.g. `"350"`, `"575"`, `"400"`, `"600"`, `"800"`, `"1000"`  
  - `addPower` – number in **diopters**, e.g. `2.5` (= +2.50), `7.5` (= +7.50)

- **Uniqueness:** One combination per item: `(itemId, baseCode, addPower)`.

- **Usage:**  
  - Order items can reference an **item** and, when the item has bases, a chosen **itemBaseId**.  
  - Pricing can be per **item + itemBase** (item-only pricing per base).  
  - **GET /api/v1/items/:id/bases** returns all bases for that item.  
  - **GET /api/v1/items/:id/order-info?itemBaseId=...** returns pricing and machine for that item+base.

So “add a base for every item” = **for each item, create one or more `ItemBase` rows** with that item’s `baseCode` and `addPower` values.

---

## 3. How to add bases

### Option A – Seed (bulk)

In `src/seed.ts`, the **item bases** array lists `(itemCode, baseCode, addPower)` (add power in diopters). Example already in seed:

- **3221:** 350 @ 2.5, 575 @ 2.5  
- **1311:** 400 @ 2.5, 600 @ 2.5, 800 @ 7.5, 1000 @ 7.5  

To add **1322 SV plastic white** with 400+25, 600+25, 800+75, 1000+75:

1. Add the **item** 1322 in the lens items seed list (if not already there).  
2. In the **item bases** seed array, add rows:  
   `1322, 400, 2.5`  
   `1322, 600, 2.5`  
   `1322, 800, 7.5`  
   `1322, 1000, 7.5`  

Then run your seed command (e.g. `npm run seed`). This matches the industry notation 400+25 → baseCode `"400"`, addPower `2.5`; 800+75 → baseCode `"800"`, addPower `7.5`.

### Option B – API (one base at a time)

- **POST /api/v1/items/:id/bases**  
  Body: `{ "baseCode": "400", "addPower": 2.5 }`  
  Creates one base for that item. Use the item’s UUID as `:id`.

- **PATCH /api/v1/items/:id/bases/:baseId**  
  Body: `{ "baseCode": "600", "addPower": 2.5 }` (both optional; only send fields to change).  
  Updates the base. `:baseId` is the ItemBase UUID.

- **DELETE /api/v1/items/:id/bases/:baseId**  
  Removes the base. Fails if any pricing or order item still references this base (DB foreign key).

After adding a base, if you use **item-only pricing per base**, create a **pricing** row for that `itemId` + `itemBaseId` (via your pricing API or admin).

---

## 4. Summary

- **Industry:** Each product (item code) has several variants: **base** (e.g. 350, 575, 400, 600, 800, 1000) and **add** (e.g. +2.50, +7.50 D). Notation like 350+25 = base 350, add +2.50 D.
- **System:** Each variant = one **ItemBase** row: `itemId`, `baseCode`, `addPower` (diopters).
- **Add a base for every item:**  
  - Either **seed** (add the item, then add rows in the item bases array with `itemCode`, `baseCode`, `addPower`),  
  - Or **POST /api/v1/items/:itemId/bases** with `baseCode` and `addPower`.  
Then add pricing per item+base if needed.
