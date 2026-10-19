-- Run once against an existing PostgreSQL database before restarting the updated API.
-- Fresh installations created from the updated SQLAlchemy models do not need this migration.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'PENDING_DESTINATION_APPROVAL';
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'PENDING_SOURCE_DISPATCH';
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS manager_user_id INTEGER NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS requested_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS destination_approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS source_dispatched_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS received_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS reason VARCHAR(500) NULL;

-- Legacy pending transfers are not auto-approved. Review them manually before migrating any in-flight stock.

ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS destination_approved_at TIMESTAMP NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS source_dispatched_at TIMESTAMP NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMP NULL;
ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP NULL;
