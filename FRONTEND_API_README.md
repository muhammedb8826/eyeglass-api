## Frontend API README

This file is the **starting point for frontend developers** integrating with this backend.

- **Generic app features** (auth, users, generic orders, etc.): see `FRONTEND_GUIDE.md`.
- **Eyeglass‑specific logic** (prescriptions, lens items, bases, ADD, etc.): see `FRONTEND_EYEGLASS_README.md`.

This README focuses on **shared API behavior** that all frontends should follow.

---

## 1. Base configuration

- **Base URL**: `http://<host>:8080/api/v1`
- **Content-Type**: `application/json`
- **Auth**:  
  - `Authorization: Bearer <accessToken>` for protected routes  
  - Auth endpoints, token lifetime, and examples are in `FRONTEND_GUIDE.md`.
- **Static files**: `http://<host>:8080/uploads/<subfolder>/<filename>`

---

## 2. Standard response format

All controllers use a **global success wrapper** and a **global error format**.

### 2.1 Success responses

Shape:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* payload depends on endpoint */ },
  "timestamp": "2026-02-23T12:34:56.789Z"
}
```

Notes:

- `data` is always present for `success: true`.
- Some list endpoints may also include pagination metadata; see `FRONTEND_GUIDE.md` for those specific responses.

### 2.2 Error responses

Shape:

```json
{
  "success": false,
  "message": "Human‑readable error message",
  "timestamp": "2026-02-23T12:34:56.789Z",
  "path": "/api/v1/orders",
  "error": {
    "code": "BAD_REQUEST",
    "details": "Optional technical explanation",
    "field": "optional-field-name"
  }
}
```

Common `error.code` values (see `src/common/response.types.ts`):

- `BAD_REQUEST`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
  `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`, `RATE_LIMIT_EXCEEDED`, etc.

Frontend handling recommendations:

- Check `success` first.
- Use `message` as the main user‑facing text.
- Use `error.code` and `error.field` to drive UI behavior (highlight a field, show a specific banner, retry, etc.).

---

## 3. High‑level domains

Only a brief overview is given here; see the specialized READMEs for details.

- **Auth & users** – login, signup, refresh tokens, user roles  
  → `FRONTEND_GUIDE.md`

- **Generic orders & sales** – non‑eyeglass flows already present in the original app  
  → `FRONTEND_GUIDE.md`

- **Eyeglass customers, orders & items** – patients, prescriptions, lens jobs, lens blanks, item bases, and pricing  
  → `FRONTEND_EYEGLASS_README.md`

---

## 4. Where to look for specifics

- If you are building **general app screens** (login, user management, generic order list):  
  work from `FRONTEND_GUIDE.md` and use this README only for response/error shapes.

- If you are building **eyeglass‑only screens** (Rx entry, lens selection, base selection, lab workflow):  
  start from `FRONTEND_EYEGLASS_README.md`, and refer back here for how to interpret success/errors.

The goal is to keep **generic API behavior** in this README and **feature‑specific rules** in their own documents, so each file stays focused and easy to use.

