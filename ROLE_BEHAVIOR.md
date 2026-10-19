# DistribuStock role behavior (updated)

## Roles
- **Owner** (`owner@example.com` / `Owner@12345`): company-wide summaries, warehouse performance, all inventory/orders/transactions, and oversight actions on transfers.
- **Admin** (`admin@example.com` / `Admin@12345`): operational administration and transfer oversight.
- **Warehouse manager**: one account assigned to one warehouse. Managers see operational inventory/orders/transactions for their own warehouse, can create stock-transfer requests from their warehouse, approve/reject requests addressed to their warehouse, dispatch approved transfers from their warehouse, and confirm receipts into their warehouse.
- **Customer** (`customer1@example.com` / `Customer@12345`): customer shop and their own orders only.

## Transfer workflow
1. **Request created** — source stock is reserved immediately so it cannot be sold or requested in another transfer while awaiting approval.
2. **Destination approval** — only the destination manager (or Owner/Admin oversight) can approve or reject. Rejection releases the source reservation.
3. **Source dispatch** — only the source manager (or Owner/Admin oversight) can confirm dispatch. The source's on-hand and reserved quantities are reduced, and an outbound transaction is recorded.
4. **Destination receipt** — only the destination manager (or Owner/Admin oversight) can confirm arrival. Destination stock increases and an inbound transaction is recorded.
5. Every transfer stores the actor IDs and timestamps for approval, rejection, dispatch and receipt. Status changes are validated server-side; the UI is not the security boundary.

## Live backend accounts
- Owner: `owner@example.com` / `Owner@12345`
- Admin: `admin@example.com` / `Admin@12345`
- Hyderabad manager: `manager.hyd@example.com` / `Manager@12345`
- Bengaluru manager: `manager.blr@example.com` / `Manager@12345`
- Mumbai manager: `manager.mum@example.com` / `Manager@12345`
- Delhi manager: `manager.del@example.com` / `Manager@12345`
- Customer: `customer1@example.com` / `Customer@12345`

These credentials are for local demonstrations only. Change them and the JWT secret before any deployment outside a trusted demo environment.

## UI behaviour per role (v3)
- **Owner:** Command dashboard + *Managers* page with a 0-100 performance score per warehouse manager (see `docs/UI_UX_GUIDE.md` for the formula).
- **Warehouse manager:** home shows only their warehouse; transfer actions appear only when it is their turn; they see their own score but not other managers'.
- **Admin:** Operations home and DBMS lab; no manager scorecards.
- **Customer:** light-themed shop and own order history only.
