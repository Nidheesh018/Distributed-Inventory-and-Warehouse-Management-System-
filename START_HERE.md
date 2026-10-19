# START HERE — DistribuStock

## What this project does

This project demonstrates a safe multi-warehouse inventory system. The main DBMS problem is preventing overselling when multiple orders compete for the same stock.

## Fastest setup

### 1. Install Docker Desktop

Make sure Docker is running.

### 2. Open a terminal in this folder

Run:

```bash
docker compose up --build
```

### 3. Open the app

Frontend: http://localhost:5173

API docs: http://localhost:8000/docs

Health check: http://localhost:8000/api/health

### 4. Demo login

Customer:

```text
customer1@example.com
Customer@12345
```

Admin:

```text
admin@example.com
Admin@12345
```

Owner:

```text
owner@example.com
Owner@12345
```

Warehouse managers (each assigned to one warehouse):

```text
manager.hyd@example.com / Manager@12345
manager.blr@example.com / Manager@12345
manager.mum@example.com / Manager@12345
manager.del@example.com / Manager@12345
```

## Best college-demo flow

1. Login as Customer.
2. Open Customer Portal.
3. Place one product order.
4. Show the selected warehouse.
5. Open Orders and Inventory.
6. Explain that the order transaction uses row locking and a second stock check.
7. Login as Admin/Manager.
8. Open Transfers and demonstrate destination approval → source dispatch → destination receipt.
9. Login as Owner: scroll the Command chapters, then open **Managers** for every manager's performance scorecard.
10. Show `docs/ARCHITECTURE.md` and `docs/ER_DIAGRAM.md` during the DBMS explanation.
11. For an existing PostgreSQL volume, apply `database/migration_owner_transfers.sql` before restarting the API.

## Reset demo data

```bash
docker compose down -v
docker compose up --build
```

The `-v` removes the PostgreSQL volume, so the demo data is recreated from scratch.

## Important

The bundled credentials and Docker database password are for a classroom demo only. Do not deploy them publicly.

## Offline UI Demo Mode

You can explore the entire frontend without PostgreSQL, FastAPI, Docker, or a login.

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL and click **Enter Demo** on the login screen.

Demo mode uses local browser storage and simulates dashboard metrics, inventory, warehouses, orders, allocation decisions, and stock deductions. Clicking **Order 1 Unit** creates a local order, selects a warehouse, reduces stock, and records a transaction. Use the browser's local storage reset (or clear site data) to reset the simulation.

The normal **Sign in to live system** path remains available when the FastAPI/PostgreSQL backend is running.

## UI v3 notes

* Each role now has its own themed workspace; see `docs/UI_UX_GUIDE.md` and `frontend/DESIGN_SYSTEM.md`.
* Run `npm install` again in `frontend/` (the old 3D world scene was replaced by a contained hero scene).
* The offline demo state key changed to `distribustock_demo_state_v2`; old demo data is replaced automatically.
