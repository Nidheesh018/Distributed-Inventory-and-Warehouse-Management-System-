from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import AllocationDecision, Customer, Inventory, InventoryTransaction, Order, OrderItem, OrderStatus, Product, Warehouse
from app.services.allocation import haversine_km, warehouse_score

class OrderError(Exception):
    pass


def create_order(db: Session, customer_id: int, items: list[dict], actor_user_id: int | None = None) -> Order:
    if not items:
        raise OrderError("Order must contain at least one item")

    quantities: dict[int, int] = {}
    for item in items:
        product_id = int(item["product_id"])
        quantities[product_id] = quantities.get(product_id, 0) + int(item["quantity"])

    try:
        with db.begin():
            customer = db.get(Customer, customer_id)
            if not customer:
                raise OrderError("Customer not found")

            products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(quantities))).all()}
            missing = set(quantities) - set(products)
            if missing:
                raise OrderError(f"Product not found: {sorted(missing)[0]}")
            inactive = [p.id for p in products.values() if not p.active]
            if inactive:
                raise OrderError(f"Product is inactive: {inactive[0]}")

            order = Order(customer_id=customer_id, status=OrderStatus.PENDING, total_amount=Decimal("0.00"))
            db.add(order)
            db.flush()

            warehouses = db.scalars(select(Warehouse).where(Warehouse.status == "active").order_by(Warehouse.id)).all()
            candidates = []
            for wh in warehouses:
                inventory_rows = db.scalars(select(Inventory).where(Inventory.warehouse_id == wh.id, Inventory.product_id.in_(quantities))).all()
                inventory_by_product = {row.product_id: row for row in inventory_rows}
                if any(pid not in inventory_by_product for pid in quantities):
                    continue
                ratios = []
                sufficient = True
                for pid, requested in quantities.items():
                    available = inventory_by_product[pid].quantity - inventory_by_product[pid].reserved_quantity
                    if available < requested:
                        sufficient = False
                        break
                    ratios.append(available / requested)
                if not sufficient:
                    continue
                score = warehouse_score(
                    availability_ratio=min(ratios),
                    priority=wh.priority,
                    distance_km=haversine_km(customer.latitude, customer.longitude, wh.latitude, wh.longitude),
                    current_load=wh.current_load,
                    capacity=wh.capacity,
                )
                candidates.append((wh, score))

            if not candidates:
                raise OrderError("No single warehouse can currently fulfill the complete order")
            candidates.sort(key=lambda x: (-x[1]["final_score"], x[0].id))
            selected_warehouse = candidates[0][0]

            for wh, score in candidates:
                db.add(AllocationDecision(order_id=order.id, warehouse_id=wh.id, stock_score=score["stock_score"], priority_score=score["priority_score"], proximity_score=score["proximity_score"], load_score=score["load_score"], final_score=score["final_score"], selected=(wh.id == selected_warehouse.id)))

            total = Decimal("0.00")
            for product_id, requested in quantities.items():
                product = products[product_id]
                inventory = db.scalar(select(Inventory).where(Inventory.warehouse_id == selected_warehouse.id, Inventory.product_id == product_id).with_for_update())
                if not inventory:
                    raise OrderError("Inventory row missing during checkout")
                available = inventory.quantity - inventory.reserved_quantity
                if available < requested:
                    raise OrderError("Inventory changed during checkout. Please retry.")
                inventory.quantity -= requested
                subtotal = product.price * requested
                total += subtotal
                db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=requested, unit_price=product.price, subtotal=subtotal))
                db.add(InventoryTransaction(transaction_type="ORDER_DEBIT", product_id=product.id, warehouse_id=selected_warehouse.id, quantity=-requested, reference_type="order", reference_id=order.id, user_id=actor_user_id))

            order.total_amount = total
            order.selected_warehouse_id = selected_warehouse.id
            order.status = OrderStatus.ALLOCATED
            db.flush()

        db.refresh(order)
        return order
    except OrderError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise OrderError("Order could not be completed safely") from exc
