# Architecture & DBMS Design

## System purpose

DistribuStock models a multi-warehouse inventory network. The database is centralized in the reference implementation to make consistency, ACID transactions and concurrency control explicit.

## Components

```text
┌──────────────────────────────┐
│ React + TypeScript UI        │
│ Login / Dashboard / Orders   │
└──────────────┬───────────────┘
               │ HTTPS/REST
┌──────────────▼───────────────┐
│ FastAPI                      │
│ Auth / validation / RBAC     │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ Service Layer                │
│ Allocation / Orders / Moves  │
└──────────────┬───────────────┘
               │ SQLAlchemy
┌──────────────▼───────────────┐
│ PostgreSQL                   │
│ Constraints / transactions   │
│ row locks / audit ledger     │
└──────────────────────────────┘
```

## Order consistency

The order service deliberately separates **candidate evaluation** from the final critical section.

Candidate evaluation determines which warehouse is best. The selected inventory rows are then locked with `SELECT ... FOR UPDATE` and stock is re-checked before deduction.

This matters because stock may change between the initial read and the final write.

## Isolation/concurrency reasoning

PostgreSQL row locks prevent two transactions from simultaneously modifying the same inventory row. The second transaction waits for the first transaction to finish and then sees the committed state before its own re-check.

The application therefore handles the classic lost-update/overselling scenario.

## Transfer deadlock prevention

Transfers lock both inventory rows in ascending warehouse ID order. If two transactions transfer the same product in opposite directions, both use the same global lock order instead of each acquiring locks in a different order.

## Normalization

The schema separates independent entities and relationships:

- `users` stores identity and role
- `customers` stores customer-specific data
- `products` stores product master data
- `warehouses` stores warehouse master data
- `inventory` resolves warehouse/product stock
- `orders` stores order headers
- `order_items` stores order/product quantities
- `warehouse_transfers` stores movement headers
- `inventory_transactions` stores stock movement history
- `allocation_decisions` stores explainable allocation results

This avoids repeating customer, product and warehouse attributes inside every transaction row.

## Integrity

The database, not just Python, enforces important invariants using foreign keys, unique constraints and check constraints.

## Audit model

`inventory_transactions` is an application-level audit ledger. It records the business events that change stock. It is not presented as cryptographically immutable; database-level tamper prevention would be an additional security control.
