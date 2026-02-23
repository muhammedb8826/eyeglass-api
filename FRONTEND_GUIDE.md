# Frontend Integration Guide

This document describes how the backend API is implemented and how frontend applications should integrate with it.

---

## Base Configuration

| Setting | Value |
|---------|-------|
| **Base URL** | `{host}/api/v1` |
| **Default Port** | `8080` |
| **Content-Type** | `application/json` |
| **Authentication** | Bearer JWT in `Authorization` header |

### Static Assets

- **Uploads path**: `/uploads/` (e.g., profile images at `/uploads/profile/{filename}`)
- Profile image URLs: `{host}/uploads/profile/{filename}`

### CORS

- All origins allowed
- Credentials supported
- Methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`
- Headers: `Content-Type`, `Authorization`, `Accept`, `Origin`, `X-Requested-With`

---

## Authentication

### Overview

- JWT-based auth with access and refresh tokens
- Access token: 24 hours
- Refresh token: 72 hours
- Protected routes require: `Authorization: Bearer {accessToken}`

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register new user |
| POST | `/signin` | Login |
| POST | `/refresh` | Refresh tokens (requires refresh token in `Authorization` header) |
| POST | `/contact` | Submit contact form |
| POST | `/orders` | Create order |
| POST | `/orders/debug` | Create order (debug) |
| GET | `/orders/all` | List all orders |

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | Public | Register |
| POST | `/signin` | Public | Login |
| POST | `/logout` | Required | Logout (invalidates refresh token) |
| POST | `/refresh` | Refresh token | Get new access + refresh tokens |

### Sign Up

**Request:** `POST /api/v1/signup`

```json
{
  "email": "user@example.com",
  "password": "password123",
  "phone": "1234567890",
  "address": "123 Main St"
}
```

**Response:** `{ tokens: { accessToken, refreshToken }, user: User }`

### Sign In

**Request:** `POST /api/v1/signin`

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `{ tokens: { accessToken, refreshToken }, user: User }`

### Logout

**Request:** `POST /api/v1/logout`  
**Headers:** `Authorization: Bearer {accessToken}`

### Refresh Tokens

**Request:** `POST /api/v1/refresh`  
**Headers:** `Authorization: Bearer {refreshToken}`

**Response:** `{ accessToken, refreshToken, user }`

---

## Account (Current User)

All account endpoints require authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/account/me` | Get current user profile |
| PATCH | `/account/me` | Update current user profile |
| PATCH | `/account/password` | Change password |

### Get Current User

**Request:** `GET /api/v1/account/me`  
**Headers:** `Authorization: Bearer {accessToken}`

**Response:** User object (no password fields). `profile` is a path like `/uploads/profile/{filename}`.

### Update Profile

**Request:** `PATCH /api/v1/account/me`  
**Content-Type:** `multipart/form-data` (to support profile image) or `application/json`

Form fields (all optional): `email`, `first_name`, `middle_name`, `last_name`, `gender`, `phone`, `address`, `profile` (image file)

For profile image: send as `multipart/form-data` with `profile` as the file field. Allowed formats: jpg, jpeg, png, gif, webp, tiff, bmp.

JSON alternative (no image):
```json
{
  "email": "new@example.com",
  "first_name": "John",
  "middle_name": "M",
  "last_name": "Doe",
  "gender": "MALE",
  "phone": "1234567890",
  "address": "456 Oak Ave"
}
```

Email and phone are validated for uniqueness.

### Change Password (User Self-Service)

**Request:** `PATCH /api/v1/account/password`

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

New password must be at least 6 characters. Requires current password.

### Admin Reset Password

When a user forgets their password, an admin can reset it:

**Request:** `PATCH /api/v1/users/:id/reset-password`  
**Headers:** `Authorization: Bearer {accessToken}` (admin only)

```json
{
  "newPassword": "newpassword"
}
```

Requires `ADMIN` role. New password must be at least 6 characters.

---

## User Roles

| Role | Value |
|------|-------|
| User | `USER` |
| Admin | `ADMIN` |
| Reception | `RECEPTION` |
| Graphic Designer | `GRAPHIC_DESIGNER` |
| Operator | `OPERATOR` |
| Finance | `FINANCE` |
| Store Representative | `STORE_REPRESENTATIVE` |
| Purchaser | `PURCHASER` |

---

## Resource Endpoints

All resource endpoints below require authentication unless marked otherwise.

### Pagination

Many list endpoints support pagination via query params:

- `page` (default: 1)
- `limit` (default: 10)

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users` | Required | Create user (multipart: `profile` image + JSON body) |
| GET | `/users` | Required | List users (paginated: `page`, `limit`) |
| GET | `/users/all` | Required | List all users |
| GET | `/users/by-role` | Required | List users by role (`?roles=ADMIN`) |
| GET | `/users/:id` | Required | Get user by ID |
| PATCH | `/users/:id/reset-password` | Admin only | Reset user password (`{ newPassword }`) |
| PATCH | `/users/:id` | Required | Update user (multipart: `profile` image + JSON body) |
| DELETE | `/users/:id` | Required | Delete user |

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | Public | Create order |
| POST | `/orders/debug` | Public | Create order (debug) |
| GET | `/orders` | Required | List orders (paginated, filterable) |
| GET | `/orders/all` | Public | List all orders |
| GET | `/orders/:id` | Required | Get order |
| PATCH | `/orders/:id` | Required | Update order |
| DELETE | `/orders/:id` | Required | Delete order |
| GET | `/orders/:id/profit` | Required | Get order profit |
| GET | `/orders/profit/filtered` | Required | Get filtered profit |
| GET | `/orders/report/company` | Required | Company report |

**Order list query params:** `page`, `limit`, `search`, `startDate`, `endDate`, `item1`, `item2`, `item3`

### Order Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order-items` | Create order item |
| GET | `/order-items/all` | List all |
| GET | `/order-items/:orderId` | Get by order ID |
| PATCH | `/order-items/:id` | Update |
| DELETE | `/order-items/:id` | Delete |

### Order Item Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order-item-notes/:orderItemId` | Create note |
| GET | `/order-item-notes/:orderItemId` | Get notes for order item |
| GET | `/order-item-notes/note/:id` | Get note by ID |
| PATCH | `/order-item-notes/note/:id` | Update note |
| DELETE | `/order-item-notes/note/:id` | Delete note |

### Items, Services, Pricing, etc.

Standard CRUD pattern for:

- **Items**: `/items` (POST, GET, GET all, GET :id, PATCH, DELETE)
- **Services**: `/services`
- **Non-stock Services**: `/non-stock-services`
- **Pricing**: `/pricing`
- **Unit Category**: `/unit-category`
- **UOM**: `/uom`
- **Vendors**: `/vendors`
- **Customers**: `/customers`
- **Sales Partners**: `/sales-partners`
- **Machines**: `/machines`
- **Operator Stocks**: `/operator-stocks`
- **Purchases**: `/purchases`
- **Purchase Items**: `/purchase-items`
- **Purchase Item Notes**: `/purchase-item-notes`
- **Sales**: `/sales`
- **Sale Items**: `/sale-items`
- **Sale Item Notes**: `/sale-item-notes`
- **Payment Terms**: `/payment-terms`
- **Payment Transactions**: `/payment-transactions`
- **Commissions**: `/commissions`
- **Commission Transactions**: `/commission-transactions`
- **Discounts**: `/discounts`
- **Fixed Cost**: `/fixed-cost`
- **File Path**: `/file-path`
- **User Machine**: `/user-machine`

### File Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/file/upload` | Upload file (multipart, field: `file`) |

**Allowed formats:** jpg, jpeg, png, gif

### Contact

**Request:** `POST /api/v1/contact` (Public)

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "company": "Acme Inc",
  "serviceType": "Printing",
  "projectDetails": "Project description"
}
```

---

## Error Responses

All errors follow this shape:

```json
{
  "statusCode": 400,
  "timestamp": "2025-02-22T12:00:00.000Z",
  "path": "/api/v1/...",
  "message": "Error description or validation messages"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request (validation, invalid input) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (e.g., wrong password, access denied) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate email/phone) |
| 500 | Internal Server Error |

### Validation Errors

Validation uses `class-validator`. On failure, `message` may be a string or an object with field-level errors.

---

## Token Refresh Flow

1. Call protected endpoint with `Authorization: Bearer {accessToken}`.
2. On 401, call `POST /refresh` with `Authorization: Bearer {refreshToken}`.
3. Store new `accessToken` and `refreshToken` from response.
4. Retry original request with new access token.
5. If refresh fails (401), redirect to login.

---

## Multipart Requests

### User Profile Image

- **Create user:** `POST /users` with `multipart/form-data`
  - `profile`: image file (jpg, jpeg, png, gif, webp, tiff, bmp)
  - Other user fields as form fields
- **Update user:** `PATCH /users/:id` with same format

### File Upload

- **Upload:** `POST /file/upload` with `multipart/form-data`
  - `file`: image file (jpg, jpeg, png, gif)

---

## Environment

- **Backend URL:** Set via `VITE_NEST_BACKEND_URL` or similar in frontend env (e.g., `http://localhost:8080/api/v1`).
- **Token storage:** Access and refresh tokens typically stored in `localStorage` or secure storage.
- **User data:** User object from signin/signup/refresh can be stored for UI; use `GET /account/me` to refresh from server.
