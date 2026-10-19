-- Deterministic PostgreSQL schema for the project.
-- The API's create_all is retained as a demo-safe idempotency fallback.
\i /docker-entrypoint-initdb.d/schema.sql
