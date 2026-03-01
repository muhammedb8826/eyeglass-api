# Lab Tools (Base Curve)

Lab tools are physical blocks (base curve tools) required to produce lens orders. Each order item can specify a **base curve** (e.g. from prescription). The system checks that at least one lab tool **covers** that base curve and has **quantity > 0** before the order can be created or updated.

## Model

- **baseCurveMin** / **baseCurveMax**: Range of base curve values this tool covers (inclusive). For a single-value tool (e.g. "125"), set both to the same value.
- **quantity**: Available pieces. Must be > 0 for the tool to be considered available.
- **code**: Optional display code (e.g. `"125-150"`, `"250"`).

An order item with `baseCurve: 200` is covered by any tool where `baseCurveMin <= 200 <= baseCurveMax` and `quantity > 0`.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/lab-tools` | Create a lab tool |
| GET | `/api/v1/lab-tools` | List (paginated: `?page=1&limit=50`) |
| GET | `/api/v1/lab-tools/check?baseCurves=125,200,250` | Check which base curves have no available tool (returns `{ missing: number[] }`) |
| GET | `/api/v1/lab-tools/:id` | Get one |
| PATCH | `/api/v1/lab-tools/:id` | Update |
| DELETE | `/api/v1/lab-tools/:id` | Delete |

## Order validation

After order **create** or **update**, the backend:

1. Collects all `baseCurve` values from order items (ignores null/undefined).
2. For each value, checks that at least one lab tool covers it and has `quantity > 0`.
3. If any base curve has no available tool, the request fails with **400** and message:  
   `Cannot produce order: no lab tool available for base curve(s) 125, 300. Add or restock these tools.`

Orders without any order item `baseCurve` set are not checked.

## Adding tools

- **Seed**: Run `npm run seed` (or your seed script) to insert a starter set of tools.
- **API**: Use `POST /api/v1/lab-tools` with body `{ "code": "225-475", "baseCurveMin": 225, "baseCurveMax": 475, "quantity": 1 }`.
- Add more tools from your paper list by converting each row to `baseCurveMin`, `baseCurveMax`, and `quantity` (Pcs).

## Example payloads

**Create tool (single value):**
```json
{ "code": "250", "baseCurveMin": 250, "baseCurveMax": 250, "quantity": 1 }
```

**Create tool (range):**
```json
{ "code": "250-450", "baseCurveMin": 250, "baseCurveMax": 450, "quantity": 7 }
```

**Check availability:**
```
GET /api/v1/lab-tools/check?baseCurves=125,200,350
→ { "missing": [350] }   if no tool covers 350
→ { "missing": [] }      if all covered
```
