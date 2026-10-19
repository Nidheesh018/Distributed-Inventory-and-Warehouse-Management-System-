# DistribuStock v3 — Validation Report

## Summary
The project is **not fully verified as working** in this environment. Static Python syntax validation passed, but full backend, frontend, and database integration tests could not be completed because required dependencies/runtime services were unavailable.

## Checks performed

| Check | Result | Details |
|---|---|---|
| ZIP contents | PASS | Archive extracted; expected frontend, backend, SQL, tests, and Docker Compose files are present. |
| Python syntax | PASS | `compileall` completed without syntax errors. |
| Backend pytest suite | BLOCKED | Test collection stopped because the environment does not have the `python-jose` dependency installed (`ModuleNotFoundError: jose`). No tests actually ran. |
| Frontend TypeScript/Vite build | BLOCKED | Frontend dependencies were not available; `npm ci` did not complete in the execution window, and `node_modules/.bin/tsc` was absent. |
| Docker/database integration | NOT RUN | Docker executable/runtime was unavailable, so PostgreSQL, API startup, and concurrent transaction tests could not be exercised. |
| Live UI/API behavior | NOT RUN | Cannot claim end-to-end behavior is verified without a running frontend, API, and PostgreSQL instance. |

## Fix applied
Updated `frontend/src/services/api.ts` demo-mode product creation to validate required text fields, duplicate SKUs, non-negative finite prices, non-negative integer reorder levels and initial stock, and warehouse IDs. Warehouse managers in demo mode are now restricted to their assigned warehouse for initial stock, matching the live API's intended scope more closely.

## Remaining recommended checks
Run from the project root on a machine with Docker installed:

```bash
docker compose up --build
```

Then verify:
- `http://localhost:8000/api/health` reports both API and database healthy.
- `http://localhost:8000/docs` loads.
- Customer, owner, admin, and warehouse-manager login flows work.
- Orders with insufficient stock fail without changing inventory.
- Two concurrent orders cannot oversell stock.
- Transfer approval, rejection, dispatch, and receipt preserve quantity/reservation invariants.
- Customers cannot access other customers' orders/allocation history, and managers cannot access another warehouse's inventory or perform its transfer actions.

The checked-in demo credentials and default Docker JWT secret are not suitable for public deployment.
