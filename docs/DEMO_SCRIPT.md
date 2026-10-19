# 5-Minute Viva / Demo Script

## 0:00 — Problem

"Imagine four warehouses holding the same product network. If two customers buy the last few units at the same time, a normal CRUD application can oversell the stock. Our project focuses on solving that database consistency problem."

## 0:30 — Architecture

"The frontend is React and TypeScript. Requests go to FastAPI, then to a service layer, SQLAlchemy and finally PostgreSQL. The important business rules are backed by database constraints and transactions."

## 1:00 — Customer order

Log in as customer and place an order.

Say:

"The system checks all active warehouses, removes warehouses that cannot fulfill the complete order, calculates a score, and stores the allocation decision."

## 1:45 — ACID

"The order is one transaction. Stock deduction, order items and audit entries either all commit or all roll back. We don't want an order without the corresponding stock movement."

## 2:15 — Row locking

"The selected inventory rows are locked using PostgreSQL `SELECT FOR UPDATE`. After obtaining the lock, the service checks available stock again. This protects us from concurrent overselling."

## 2:50 — Transfer

Sign in as manager/admin and explain:

"A warehouse transfer locks both inventory rows in deterministic ID order, deducts the source, adds the destination and writes two ledger events inside one transaction."

## 3:30 — DBMS schema

Show the ER diagram/schema and explain:

"We separated users, customers, products, warehouses, inventory, orders and order items to keep the relational design normalized. Foreign keys preserve referential integrity and unique/check constraints protect important business invariants."

## 4:10 — Security

"The API uses JWT authentication and role-based authorization. Customer accounts can access their own orders, while operational transfer endpoints require admin or warehouse-manager privileges."

## 4:30 — Limitation honesty

"The reference implementation uses one PostgreSQL database. Distributed here means the business operation spans multiple warehouse locations; physical database sharding or replication is outside the academic scope."

## 4:45 — Close

"So the main contribution is not the UI. It is showing how database constraints, transactions and row-level locking work together to keep inventory correct under concurrent operations."
