# ER Model

```text
USER 1 ───── 0..1 CUSTOMER
                     │
                     │ places
                     ▼
                   ORDER 1 ───── N ORDER_ITEM N ───── 1 PRODUCT
                     │
                     │ allocated to
                     ▼
                 WAREHOUSE
                     │
                     │ holds
                     ▼
                  INVENTORY
                     ▲
                     │
                   PRODUCT

PRODUCT + SOURCE WAREHOUSE + DESTINATION WAREHOUSE
                    │
                    ▼
            WAREHOUSE_TRANSFER

ORDER ───────────────► ALLOCATION_DECISION ◄──────── WAREHOUSE

ORDER / TRANSFER ───► INVENTORY_TRANSACTION ◄──────── WAREHOUSE
```

## Key relationships

- User → Customer: one-to-zero/one
- Customer → Order: one-to-many
- Order → OrderItem: one-to-many
- Product → OrderItem: one-to-many
- Warehouse ↔ Product: many-to-many resolved by Inventory
- Order → AllocationDecision: one-to-many
- Product/Warehouse → InventoryTransaction: stock movement history
- WarehouseTransfer references one product, one source warehouse and one destination warehouse
