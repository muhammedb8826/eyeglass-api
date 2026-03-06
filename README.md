# Eyeglass API (IAN Backend)

NestJS backend for the eyeglass / IAN project. REST API for orders, items, pricing, customers, sales, purchases, lab tools, and related resources.

## Tech stack

- **Runtime:** Node.js
- **Framework:** NestJS
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens)

## Prerequisites

- Node.js (v18+)
- PostgreSQL
- npm or yarn

## Installation

```bash
npm install
```

## Environment

Copy the template and set your values:

```bash
cp env-template.txt .env
```

Edit `.env` with at least:

| Variable        | Description                          |
|----------------|--------------------------------------|
| `DB_HOST`      | PostgreSQL host (default `localhost`) |
| `DB_PORT`      | PostgreSQL port (default `5432`)     |
| `DB_USERNAME`  | Database user                        |
| `DB_PASSWORD`  | Database password                    |
| `DB_DATABASE`  | Database name (default `eyeglass`)   |
| `DB_SYNCHRONIZE` | Set to `true` only for a **fresh** database so TypeORM creates the schema. Leave unset or `false` when the schema already exists (avoids "constraint already exists" errors). |
| `JWT_SECRET`   | Secret for access tokens             |
| `JWT_RT_SECRET`| Secret for refresh tokens            |

Optional: `DB_LOGGING=true`, `DB_SSL=true`, SMTP settings for contact form, etc. See `env-template.txt`.

## Running the app

```bash
# Development (watch mode)
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

Default port: `8080`. API base path: `/api/v1`.

## Database

- **Schema:** TypeORM manages the schema. Use `DB_SYNCHRONIZE=true` only on a new database; then set it back to `false` or leave it unset to avoid sync errors on existing DBs.
- **Seed:** Populates admin user, fixed costs, default machine, unit category, UOM, lens items, item bases, and lab tools:

  ```bash
  npm run seed
  ```

- **Migrations:** Scripts exist (`migration:run`, `migration:generate`) but migrations are not required if you use synchronize for a fresh DB. See `typeorm.config.ts` and `src/config/database.config.ts`.

## Order items: per-eye quantity

Order line items support **per-eye quantity** so right and left lenses can be produced separately:

- **quantityRight** – quantity for the right lens
- **quantityLeft** – quantity for the left lens
- **quantity** – total (quantityRight + quantityLeft); used for order totals and backward compatibility

Send `quantityRight` and/or `quantityLeft` in create/update payloads when you want per-eye quantities. If you only send `quantity`, it is treated as right-eye only (quantityRight = quantity, quantityLeft = 0).

## User roles (eyeglass lens lab standard)

Roles: `USER`, `ADMIN`, `RECEPTION`, `LAB_TECHNICIAN`, `OPERATOR`, `FINANCE`, `DISPENSER`, `PURCHASER`. See [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md#user-roles-eyeglass-lens-lab-standard).

## Order item statuses (eyeglass manufacturing)

Order items use: **Pending** → **InProgress** → **Ready** → **Delivered** (or **Cancelled**). **InProgress** and **Cancelled** consume operator stock. Order status is derived from its items. See [ORDER_TO_PRODUCTION_FLOW.md](ORDER_TO_PRODUCTION_FLOW.md).

## Scripts

| Command            | Description                    |
|--------------------|--------------------------------|
| `npm run start`    | Start once                    |
| `npm run start:dev`| Start in watch mode           |
| `npm run start:prod` | Start production build      |
| `npm run build`    | Build for production          |
| `npm run seed`     | Run database seed             |
| `npm run lint`     | Lint and fix                  |
| `npm run test`     | Unit tests                    |
| `npm run test:e2e` | E2E tests                     |

## API and documentation

- **Frontend integration:** See [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) for base URL, auth, and endpoint usage.
- **Eyeglass backend (developer guide):** See [EYEGLASS_BACKEND_DEVELOPER_GUIDE.md](EYEGLASS_BACKEND_DEVELOPER_GUIDE.md) for prescription model, quantity per eye, lens items/bases, lab tools, and producibility checks.
- **Response types:** See [RESPONSE_TYPES_SUMMARY.md](RESPONSE_TYPES_SUMMARY.md) if present.

## License

UNLICENSED (see `package.json`).
