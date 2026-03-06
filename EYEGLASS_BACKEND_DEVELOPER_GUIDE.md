# Eyeglass Lens Backend – Developer Guide

This document explains the **backend behavior** for eyeglass lens jobs:

- Prescription fields on `OrderItem`
- **Quantity (per eye)** – right and left lens can be produced separately
- Lens items and bases
- Lab tools and automatic producibility checks

It is aimed at backend and integration developers (NestJS services, controllers, DTOs).

---

## 1. Domain Overview

- **Customer** – patient record (DOB, gender, etc.).
- **Order** – prescription job (one or more lens lines).
- **OrderItem** – a single lens job line (usually a pair of lenses, or one eye).
- **Item** – lens blank stock item (optionally with multiple base variants).
- **ItemBase** – concrete base / ADD variant for an item (e.g. `350^+2.5`).
- **LabTool** – physical tool blocks the lab owns, stored in `lab-tools`.

The eyeglass features are implemented as **extensions** on top of the existing order and item models; all new fields are optional.

---

## 2. Order Item Prescription Model

### 2.1 Fields on `OrderItem`

On the backend, `OrderItem` / `CreateOrderItemDto` / `UpdateOrderItemDto` include:

- **Rx per eye**
  - `sphereRight`, `sphereLeft` – SPH (number)
  - `cylinderRight`, `cylinderLeft` – CYL (number)
  - `axisRight`, `axisLeft` – AXIS (number, 0–180)
  - `addRight`, `addLeft` – ADD (number)
  - `prismRight`, `prismLeft` – PRISM (number)
- **PD**
  - `pd` – binocular PD (number)
  - `pdMonocularRight`, `pdMonocularLeft` – monocular PD (number)
- **Lens parameters**
  - `lensType` – `"SINGLE_VISION"`, `"BIFOCAL"`, `"PROGRESSIVE"`, etc.
  - `lensMaterial` – `"CR-39"`, `"PLASTIC"`, `"POLYCARBONATE"`, `"HI-INDEX_1.67"`, etc.
  - `lensCoating` – `"AR"`, `"PHOTO_SOLAR"`, `"PHOTO_SOLAR_ARC"`, etc.
  - `lensIndex` – numeric index (e.g. `1.5`, `1.59`, `1.67`)
  - `baseCurve` – numeric base curve
  - `diameter` – numeric lens diameter
  - `tintColor` – e.g. `"GRAY"`, `"BROWN"`, `"GREEN"`
- **Item / base linkage**
  - `itemBaseId?: string` – chosen base variant for multi‑base items
- **Quantity (per eye – updated)**  
  Right and left lenses can be produced separately; quantity is **per prescription (per eye)**, not a single global value per line.
  - `quantity: number` – **total** (`quantityRight + quantityLeft`). Stored and used for order totals, stock/unit calculations, and pricing.
  - `quantityRight: number` – quantity for the **right** lens (per prescription). Default `0`.
  - `quantityLeft: number` – quantity for the **left** lens (per prescription). Default `0`.
  - **Create/update behavior:** If the client sends `quantityRight` and/or `quantityLeft`, the backend sets `quantity = quantityRight + quantityLeft`. If only `quantity` is sent (legacy), the backend sets `quantityRight = quantity`, `quantityLeft = 0`.

All of these are **optional** in the API where applicable; required fields are enforced by the frontend or by separate validation rules.

### 2.2 ADD handling

- If the Rx includes ADD, the client sends `addRight` / `addLeft` in **diopters** (e.g. `2.5` for +2.50 D).
- If ADD is not specified on the Rx but **distance** and **near** SPH are known, the frontend computes:

  \[
  \text{ADD} = \text{near SPH} - \text{distance SPH}
  \]

  and sends the result in `addRight` / `addLeft`.

- `addRight` / `addLeft` are used when choosing **item bases** (e.g. 3221 with ADD +2.5 → choose `350^+2.5` or `575^+2.5`).

---

## 3. Lens Items and Bases

### 3.1 Item metadata

Lens blanks are represented as `Item` records with additional metadata:

- `itemCode?: string` – printed short code (e.g. `1113`, `1123`, `3221`, `1311`)
- `lensMaterial?: string`
- `lensIndex?: number`
- `lensType?: string`

Example:

```json
{
  "itemCode": "3221",
  "name": "Progressive plastic photosolar",
  "lensMaterial": "PLASTIC",
  "lensIndex": 1.5,
  "lensType": "PROGRESSIVE"
}
```

### 3.2 Item bases (`ItemBase`)

For materials that ship with multiple base/ADD combinations under the same code (e.g. `3221`, `1311`), we create an `ItemBase` row per variant:

- `id: string`
- `itemId: string` – parent item
- `baseCode: string` – base in 0.01 diopter steps, e.g. `"350"`, `"575"`, `"400"`, `"800"`
- `addPower: number` – ADD in diopters, e.g. `2.5`, `7.5`

Backend endpoints (simplified):

- `GET /api/v1/items/:id` – includes `itemBases[]` when present.
- `GET /api/v1/items/:id/bases` – list of bases for that item.
- `POST /api/v1/items/:id/bases` – create base.
- `PATCH /api/v1/items/:id/bases/:baseId` – update base (`baseCode`, `addPower`).
- `DELETE /api/v1/items/:id/bases/:baseId` – delete base.
  - Protected by **DB foreign keys**: fails if the base is still referenced by pricing or order items.

On order items, when an item has multiple bases, the client sends `itemBaseId` with the chosen variant.

---

## 4. Lab Tools Model

### 4.1 LabTool entity

Lab tools are stored in a `lab-tools` resource:

- `id: string`
- `code?: string` – human‑friendly label (e.g. `"250-450"`, `"125"`, `"225-475"`)
- `baseCurveMin: number` – **tool units** (0.01 D steps), e.g. `250` for +2.50 D
- `baseCurveMax: number` – tool units
- `quantity: number` – available blocks at this range

Examples:

```json
{
  "code": "250-450",
  "baseCurveMin": 250,
  "baseCurveMax": 450,
  "quantity": 7
}
```

### 4.2 Lab tool endpoints

- `GET /api/v1/lab-tools` – paginated list.
- `GET /api/v1/lab-tools/:id` – single record.
- `GET /api/v1/lab-tools/check?baseCurves=250,450,...` – checks whether given tool values are covered by any tool range with `quantity > 0`.
- `POST /api/v1/lab-tools` – create.
- `PATCH /api/v1/lab-tools/:id` – update.
- `DELETE /api/v1/lab-tools/:id` – delete.

The `/lab-tools/check` route returns a `LabToolCheckResponse`:

```ts
interface LabToolCheckResponse {
  missing: number[]; // tool values (0.01 D steps) with no available tool
}
```

---

## 5. Tool Calculation from Rx + Base

### 5.1 Tool scale

All internal tool calculations work in **0.01 diopter units**:

- `0.00 D` → `0`
- `+1.00 D` → `100`
- `+1.25 D` → `125`
- `+3.25 D` → `325`
- `+3.50 D` → `350`

### 5.2 Base value

For an `ItemBase`:

- `baseCode` is already in tool units as a string, e.g. `"350"`, `"575"`.
- `addPower` is in diopters.

The effective base (tool units) is:

\[
  \text{BaseTool} = \text{baseCode} + (\text{addPower} \times 10)
\]

Examples:

- `baseCode = "350"`, `addPower = 2.5` → `BaseTool = 350 + 25 = 375`
- `baseCode = "800"`, `addPower = 7.5` → `BaseTool = 800 + 75 = 875`

### 5.3 Rx conversion

The backend accepts SPH/CYL as **diopters**:

- If SPH/CYL are sent as diopters:

  \[
    \text{SphToolMag} = |\text{SPH}| \times 100,\quad
    \text{CylToolMag} = |\text{CYL}| \times 100
  \]

- If you choose to send tool values directly (e.g. `325`), the backend must treat them as already in tool units. The current frontend normalizes both forms before calling the backend, and you should mirror that logic in services if needed.

### 5.4 Sign rule (minus/plus handling)

For each eye:

- If SPH is **negative**, the magnitude is **added** to the base.
- If SPH is **positive**, the magnitude is **subtracted** from the base.

Right eye example with base `350^+2.5`:

- `BaseTool = 375`
- `sphereRight = -0.75` → `SphToolMag = 75`
- `cylinderRight = +3.25` → `CylToolMag = 325`

Then:

\[
\begin{aligned}
R\_\text{SPH} &= \text{BaseTool} + \text{SphToolMag} = 375 + 75 = 450 \\
R\_\text{CYL} &= R\_\text{SPH} + \text{CylToolMag} = 450 + 325 = 775
\end{aligned}
\]

Left eye example:

- `BaseTool = 375`
- `sphereLeft = 0.00` → `SphToolMag = 0`
- `cylinderLeft = +3.25` → `CylToolMag = 325`

\[
\begin{aligned}
L\_\text{SPH} &= 375 + 0 = 375 \\
L\_\text{CYL} &= 375 + 325 = 700
\end{aligned}
\]

So the four tool values for this job are:

- Right: **450**, **775**
- Left: **375**, **700**

These are exactly the values we must be able to cover with lab tools.

### 5.5 Right and left lens independence

- **Right lens** tool values are computed **only** from:
  - `sphereRight`, `cylinderRight`
  - and the chosen `ItemBase` (same base is used for both eyes).
- **Left lens** tool values are computed **only** from:
  - `sphereLeft`, `cylinderLeft`
  - and the same `ItemBase`.

Right and left are **independent**: the lab can produce only the right lens, only the left lens, or both. Quantity is **per eye**: `quantityRight` and `quantityLeft` indicate how many of each lens are ordered. If the order has only one side (e.g. `quantityRight > 0`, `quantityLeft = 0`), only that eye’s Rx is required and only that eye’s tool values are computed and checked. The backend treats producibility **per eye**: e.g. if only right lens is being ordered (`quantityRight > 0`, `quantityLeft = 0`), only the right-eye tool values need to be covered by lab tools; similarly for left-only; if both are ordered, both eyes’ tool values must be covered.

---

## 6. Automatic Producibility Check

### 6.1 When the check runs

The backend performs an automatic **lab tools check** when:

- Creating an order (`POST /api/v1/orders`) with eyeglass order items.
- Updating an order item (`PATCH /api/v1/order-items/:id`) that has both:
  - a lens `itemId` and chosen `itemBaseId`, and
  - prescription values (`sphereRight/Left`, `cylinderRight/Left`).

### 6.2 Algorithm (high level)

For each eyeglass `OrderItem` where the check applies:

1. **Load item and base**
   - Resolve `Item` and `ItemBase` (`itemBaseId`) for the order item.
2. **Compute BaseTool** using §5.2.
3. **Compute tool values per eye** using §5.4 and §5.5:
   - **Right lens:** from `sphereRight` and `cylinderRight` → `R_SPH`, and if CYL ≠ 0, `R_CYL = R_SPH + CylToolMag`.
   - **Left lens:** from `sphereLeft` and `cylinderLeft` → `L_SPH`, and if CYL ≠ 0, `L_CYL = L_SPH + CylToolMag`.
   - Only compute values for the eye(s) that have Rx and are being produced (see §5.5; use `quantityRight` / `quantityLeft` to determine which eye(s) are ordered).
4. **Call lab tools check** or perform equivalent query:
   - For each tool value \(v\):
     - Find a `LabTool` such that:
       - `baseCurveMin <= v <= baseCurveMax`
       - `quantity > 0`
5. **Per-eye producibility:** For each eye that has computed tool values and is being produced (`quantityRight > 0` for right, `quantityLeft > 0` for left), check that **all** of that eye’s values are covered. If the order line is right-only (e.g. `quantityRight > 0`, `quantityLeft = 0`), require only right-eye tool values to be covered; if left-only, require only left-eye; if both, require both. **If any tool value for a produced eye has no matching `LabTool`**, the operation is rejected:

   - HTTP status: `400` or `409` (implementation‑dependent).
   - Error shape (example):

   ```json
   {
     "success": false,
     "message": "Cannot produce order: no lab tool available for calculated base/tool value(s) 450, 775.",
     "error": {
       "code": "CONFLICT",
       "details": "Missing lab tools for values [450, 775]",
       "field": "orderItems[0]"
     }
   }
   ```

6. **If all tool values are covered**, the request proceeds as normal and the order item is accepted.

### 6.3 Partial data and single-eye orders

- If **any** of the required fields for the calculation are missing (e.g. no `itemBaseId` or no SPH for an eye), the backend **skips** the tool check for that eye (or that line) and processes it as a generic item line where appropriate.
- **Single-eye orders:** If only one eye has Rx / is being produced (`quantityRight > 0` or `quantityLeft > 0` but not both), compute and validate only that eye’s tool values. This keeps the system backwards‑compatible while allowing stricter validation for fully configured eyeglass workflows.

---

## 7. Frontend vs Backend Responsibilities

- **Frontend**
  - Sends **quantity per eye** (`quantityRight`, `quantityLeft`) when right and left can be produced separately; or sends only `quantity` for legacy (right-eye only).
  - Computes the same tool values **per eye** (right from `sphereRight`/`cylinderRight`, left from `sphereLeft`/`cylinderLeft`) and shows:
    - **Calculated tools** per eye, e.g. `Right: 450, 775. Left: 375, 700`.
    - **Per-eye producibility:** for each eye that has tool values, a green “Right lens: lab tools available.” / “Left lens: lab tools available.” when that eye’s values are covered, or a red “Right lens: missing lab tools for values …” / “Left lens: missing lab tools for values …” when that eye has missing tools.
  - This is a **preview** so the operator can see whether they can produce the right lens, the left lens, or both.

- **Backend**
  - Is the **source of truth**:
    - Normalizes quantity: when `quantityRight`/`quantityLeft` are sent, sets `quantity = quantityRight + quantityLeft`; when only `quantity` is sent, sets `quantityRight = quantity`, `quantityLeft = 0`.
    - Recomputes tool values from stored `OrderItem` + `ItemBase`.
    - Queries `lab-tools` (or uses `/lab-tools/check`) to validate producibility **per produced eye** (using `quantityRight`/`quantityLeft`).
    - Rejects orders/order‑item updates when tools are missing.

The formulas and rules in this README are shared between frontend and backend so both sides stay consistent.
