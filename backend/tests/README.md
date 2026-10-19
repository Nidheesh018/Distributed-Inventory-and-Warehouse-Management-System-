# Test strategy

The unit tests cover deterministic scoring, geographic distance, password hashing and JWT claims.

For a full database integration test, run the Docker PostgreSQL service and exercise:

1. Two concurrent orders competing for the same inventory.
2. An insufficient-stock order.
3. A successful transfer.
4. An insufficient-stock transfer.
5. A rollback after an injected failure.
6. Role-protected endpoints.

The most important acceptance invariant is:

> inventory available quantity must never become negative, even when concurrent orders compete for the same stock.
