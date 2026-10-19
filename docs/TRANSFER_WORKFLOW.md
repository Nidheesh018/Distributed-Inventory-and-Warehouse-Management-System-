# Stock transfer lifecycle

A transfer is deliberately not an instant quantity move.

1. **Request**: validate source, destination, product, and quantity. Reserve the requested quantity at the source so that it cannot be sold or committed to another transfer.
2. **Destination approval**: the destination warehouse manager may approve or reject. A rejection releases the reservation and leaves on-hand stock unchanged.
3. **Source dispatch**: the source manager confirms shipment. Source on-hand stock and its reservation decrease. An outbound inventory transaction is written. Destination stock remains unchanged while the transfer is in transit.
4. **Destination receipt**: the destination manager confirms physical arrival. Destination on-hand stock increases and an inbound transaction is written.

The API checks role and warehouse assignment for every action. It also checks the transfer's current state so a request cannot be dispatched before approval or received before dispatch. Transfer rows record the actor and timestamp for each stage.

## Local demo accounts

- Owner: `owner@example.com` / `Owner@12345`
- Admin: `admin@example.com` / `Admin@12345`
- Warehouse 1 manager: `manager.hyd@example.com` / `Manager@12345`
- Warehouse 2 manager: `manager.blr@example.com` / `Manager@12345`
- Warehouse 3 manager: `manager.mum@example.com` / `Manager@12345`
- Warehouse 4 manager: `manager.del@example.com` / `Manager@12345`

These credentials are for a local demo only.
