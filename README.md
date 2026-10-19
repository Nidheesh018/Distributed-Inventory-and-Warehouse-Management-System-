# DistribuStock — Distributed Inventory & Warehouse Management System

A **DBMS + Backend** project demonstrating how a multi-warehouse inventory network can safely process customer orders and warehouse transfers using PostgreSQL, FastAPI and React.

## 1. What are we building?

In simple English:

> A customer places an order. The backend looks at every warehouse, chooses the best warehouse that can fulfill the complete order, locks the relevant inventory rows, checks the stock again, deducts the stock, records an audit transaction, and commits everything as one database transaction.

The important problem we solve is **inventory consistency under concurrent operations**. Two customers must not be allowed to buy the same physical stock because both requests happened at nearly the same time.

### Example

```text
5 laptops available

Customer A asks for 4        Customer B asks for 4
          ↓                            ↓
      Transaction A               Transaction B
          ↓                            ↓
       row lock                    waits
          ↓
       stock = 1
          ↓
        COMMIT
                                       ↓
                                  row lock acquired
                                       ↓
                                  re-check stock
                                       ↓
                               only 1 available
                                       ↓
                                     409
```

This is the DBMS heart of the project.

## 2. What is implemented

- PostgreSQL relational schema with PK/FK/UNIQUE/CHECK constraints
- Normalized entity model
- FastAPI REST backend with service layer
- JWT authentication
- Role-based authorization: admin, warehouse manager, customer
- PBKDF2 password hashing with per-password salts
- Multi-warehouse inventory
- Explainable warehouse allocation scoring
- Atomic order creation
- PostgreSQL row-level locking with `SELECT ... FOR UPDATE`
- Atomic warehouse-to-warehouse transfers
- Inventory transaction/audit ledger
- Allocation decision history
- API validation with Pydantic
- Health endpoint with database connectivity check
- Docker Compose environment with PostgreSQL health checks
- React + TypeScript demonstration UI
- DBMS-focused dashboard and viva explanation page
- Automated backend unit/integration test structure

## 3. Technology stack

```text
React + TypeScript
        ↓
FastAPI REST API
        ↓
Service Layer
        ↓
SQLAlchemy 2.x
        ↓
PostgreSQL 16
```

## 4. Database design

Core tables:

```text
users
customers
warehouses
products
inventory
orders
order_items
warehouse_transfers
inventory_transactions
allocation_decisions
```

Important integrity rules include:

- One customer profile per user
- Unique product SKU
- Unique warehouse code
- One inventory row per `(warehouse_id, product_id)`
- Inventory quantity cannot be negative
- Reserved quantity cannot exceed quantity
- Order item quantity must be positive
- Transfer source and destination must differ
- Transfer quantity must be positive
- Warehouse priority is 0–100
- Warehouse load cannot exceed capacity
- Product price cannot be negative

## 5. Allocation algorithm

A warehouse receives a score from four normalized components:

```text
40%  Stock availability
25%  Warehouse priority
20%  Geographic proximity
15%  Warehouse load headroom
```

The winning warehouse is persisted in `allocation_decisions`, along with every candidate's component scores. This makes the decision explainable instead of hiding it inside application code.

## 6. Transaction design

### Customer order

```text
BEGIN
  validate customer + products
  evaluate eligible warehouses
  calculate allocation scores
  save allocation decisions
  SELECT inventory rows FOR UPDATE
  re-check available stock
  deduct stock
  create order items
  create inventory transaction records
  mark order allocated
COMMIT
```

Any failure rolls back the complete operation.

### Warehouse transfer

The source inventory row is locked and the requested quantity is reserved when the transfer is submitted. This prevents sales or another transfer from consuming those units while the destination reviews the request. The destination manager approves/rejects, the source manager confirms dispatch, and the destination manager confirms receipt. Dispatch deducts source stock and writes `TRANSFER_OUT`; receipt adds destination stock and writes `TRANSFER_IN`. Actor IDs and timestamps are recorded at each stage. See `docs/TRANSFER_WORKFLOW.md` for the full lifecycle.

## 7. Authentication and roles

The demo uses real JWT authentication.

| Role | Typical access |
|---|---|
| Owner | Company-wide analytics and oversight |
| Admin | Operational access and transfer oversight |
| Warehouse Manager | Warehouse-scoped inventory and transfer workflow |
| Customer | Own orders + customer ordering |

Demo credentials:

```text
Admin
admin@example.com
Admin@12345

Owner
owner@example.com
Owner@12345

Warehouse Managers (one per warehouse)
manager.hyd@example.com / Manager@12345
manager.blr@example.com / Manager@12345
manager.mum@example.com / Manager@12345
manager.del@example.com / Manager@12345

Customer
customer1@example.com
Customer@12345
```

These are **demo credentials only**. Change the JWT secret and credentials before any public deployment.

## 8. Run the project

### Recommended: Docker

Install Docker Desktop, then from the project root:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

To stop:

```bash
docker compose down
```

To reset the database completely:

```bash
docker compose down -v
docker compose up --build
```

### Local backend

Create a PostgreSQL database and set:

```text
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/inventory_db
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=http://localhost:5173
```

Then:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 9. Suggested demo sequence

1. Sign in as the customer.
2. Open Customer Portal.
3. Place an order.
4. Show the selected warehouse and atomic stock deduction.
5. Open Orders.
6. Explain that the allocation service evaluated all eligible warehouses.
7. Sign in as admin/manager.
8. Show Inventory and Warehouse pages.
9. Open Swagger and demonstrate protected endpoints.
10. Explain `FOR UPDATE`, ACID, constraints, rollback and the audit ledger.

## 10. Important academic clarification

The word **distributed** refers to the business operation across multiple logical warehouse locations. The current reference implementation uses **one centralized PostgreSQL database** so inventory consistency is easy to demonstrate and defend.

It does **not** claim to be a physically sharded multi-database deployment. That would be a separate distributed-database extension.

## 11. Project quality notes

This is designed to be a strong college DBMS/backend project, not an internet-scale production platform. Production deployment would additionally require secret management, migrations, TLS, rate limiting, structured logging, monitoring, backups, CI/CD and a dedicated database deployment strategy.


## Owner role and approved transfer workflow

A fresh database seeds one owner and four warehouse managers, one per seeded warehouse. Transfers are requests: destination manager approval reserves the request, source manager dispatches it, and destination manager confirms receipt. The API records actors and timestamps and keeps inventory quantities consistent through the stages. If you already have a PostgreSQL database volume from an older version, run `database/migration_owner_transfers.sql` before restarting the backend. See `ROLE_BEHAVIOR.md` for permissions and local demo credentials.
