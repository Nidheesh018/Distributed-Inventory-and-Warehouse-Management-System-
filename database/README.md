# Database bootstrap

- `schema.sql` is the deterministic PostgreSQL schema used by Docker.
- `seed.sql` is retained as reference data SQL from the original project; the application seed is preferred because it creates secure demo password hashes and all related entities idempotently on first startup.
- `docker compose down -v` resets the demo database.
