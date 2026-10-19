from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user, require_roles
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.entities import AllocationDecision, Customer, Inventory, InventoryTransaction, Order, Product, User, UserRole, Warehouse, WarehouseTransfer, TransferStatus
from app.schemas.common import CreateOrderInput, LoginInput, LoginResponse, OrderOut, ProductCreate, ProductOut, TransferInput, UserOut
from app.services.orders import OrderError, create_order
from app.services.transfers import TransferError, request_transfer, update_transfer

router = APIRouter()


def user_out(db: Session, user: User) -> UserOut:
    customer_id = db.scalar(select(Customer.id).where(Customer.user_id == user.id))
    warehouse_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == user.id)) if user.role == UserRole.WAREHOUSE_MANAGER else None
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role.value, customer_id=customer_id, warehouse_id=warehouse_id)


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    customer_id = db.scalar(select(Customer.id).where(Customer.user_id == user.id))
    token = create_access_token(user.id, user.role.value, customer_id)
    return LoginResponse(access_token=token, user=user_out(db, user))


@router.get("/auth/me", response_model=UserOut)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_out(db, current.user)


@router.get("/products", response_model=list[ProductOut])
def products(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).where(Product.active.is_(True)).order_by(Product.name)).all()
    return rows


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    sku = payload.sku.strip().upper()
    name = payload.name.strip()
    category = payload.category.strip()
    if not sku or not name or not category:
        raise HTTPException(status_code=422, detail="SKU, name and category are required")
    if db.scalar(select(Product.id).where(Product.sku == sku)):
        raise HTTPException(status_code=409, detail="SKU already exists")
    warehouses = db.scalars(select(Warehouse).order_by(Warehouse.id)).all()
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned = db.scalar(select(Warehouse).where(Warehouse.manager_user_id == current.user.id))
        if not assigned: raise HTTPException(status_code=403, detail="No warehouse is assigned to this manager")
        warehouses = [assigned]
    warehouse_ids = {w.id for w in warehouses}
    bad_ids = set(payload.initial_stock) - warehouse_ids
    if bad_ids:
        raise HTTPException(status_code=422, detail=f"Unknown warehouse id: {sorted(bad_ids)[0]}")
    if any(q < 0 for q in payload.initial_stock.values()):
        raise HTTPException(status_code=422, detail="Initial stock cannot be negative")
    try:
        product = Product(sku=sku, name=name, description=payload.description, category=category, price=payload.price, reorder_level=payload.reorder_level, active=True)
        db.add(product)
        db.flush()
        for wh in warehouses:
            qty = int(payload.initial_stock.get(wh.id, 0))
            db.add(Inventory(warehouse_id=wh.id, product_id=product.id, quantity=qty, reserved_quantity=0))
            if qty:
                db.add(InventoryTransaction(transaction_type="INITIAL_STOCK", product_id=product.id, warehouse_id=wh.id, quantity=qty, reference_type="PRODUCT", reference_id=product.id, user_id=current.user.id))
        db.commit()
        db.refresh(product)
        return product
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Product could not be created safely") from exc


@router.get("/warehouses")
def warehouses(current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    rows = db.scalars(select(Warehouse).order_by(Warehouse.id)).all()
    managers = {u.id:u.name for u in db.scalars(select(User).where(User.role == UserRole.WAREHOUSE_MANAGER)).all()}
    return [{"id": w.id, "name": w.name, "code": w.code, "city": w.city, "priority": w.priority, "capacity": w.capacity, "current_load": w.current_load, "status": w.status, "manager_user_id": w.manager_user_id, "manager_name": managers.get(w.manager_user_id)} for w in rows]


@router.get("/inventory")
def inventory(current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    stmt = select(Inventory, Product, Warehouse).join(Product, Product.id == Inventory.product_id).join(Warehouse, Warehouse.id == Inventory.warehouse_id)
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        if assigned_id is None: raise HTTPException(status_code=403, detail="No warehouse is assigned to this manager")
        stmt = stmt.where(Inventory.warehouse_id == assigned_id)
    rows = db.execute(stmt.order_by(Warehouse.id, Product.name)).all()
    return [{"inventory_id": inv.id, "warehouse": wh.name, "warehouse_id": wh.id, "product": product.name, "product_id": product.id, "sku": product.sku, "quantity": inv.quantity, "reserved_quantity": inv.reserved_quantity, "available_quantity": inv.quantity - inv.reserved_quantity, "low_stock": (inv.quantity - inv.reserved_quantity) <= product.reorder_level} for inv, product, wh in rows]


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def place_order(payload: CreateOrderInput, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if current.user.role == UserRole.CUSTOMER:
        if current.customer_id is None:
            raise HTTPException(status_code=403, detail="Customer profile not configured")
        customer_id = current.customer_id
    else:
        if payload.customer_id is None:
            raise HTTPException(status_code=422, detail="customer_id is required for staff orders")
        customer_id = payload.customer_id
    try:
        order = create_order(db, customer_id, [item.model_dump() for item in payload.items], current.user.id)
        return OrderOut(id=order.id, customer_id=order.customer_id, status=order.status.value, total_amount=order.total_amount, selected_warehouse_id=order.selected_warehouse_id, created_at=order.created_at)
    except OrderError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/orders", response_model=list[OrderOut])
def orders(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Order).order_by(Order.created_at.desc())
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        stmt = stmt.where(Order.selected_warehouse_id == assigned_id)
    if current.user.role == UserRole.CUSTOMER:
        if current.customer_id is None:
            return []
        stmt = stmt.where(Order.customer_id == current.customer_id)
    rows = db.scalars(stmt).all()
    return [OrderOut(id=o.id, customer_id=o.customer_id, status=o.status.value, total_amount=o.total_amount, selected_warehouse_id=o.selected_warehouse_id, created_at=o.created_at) for o in rows]


@router.get("/orders/{order_id}/allocation")
def allocation(order_id: int, current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current.user.role == UserRole.CUSTOMER and order.customer_id != current.customer_id:
        raise HTTPException(status_code=403, detail="You cannot view this order")
    rows = db.execute(select(AllocationDecision, Warehouse).join(Warehouse, Warehouse.id == AllocationDecision.warehouse_id).where(AllocationDecision.order_id == order_id).order_by(AllocationDecision.final_score.desc())).all()
    return [{"warehouse": wh.name, "warehouse_id": wh.id, "stock_score": float(a.stock_score), "priority_score": float(a.priority_score), "proximity_score": float(a.proximity_score), "load_score": float(a.load_score), "final_score": float(a.final_score), "selected": a.selected} for a, wh in rows]


def _transfer_out(db: Session, t: WarehouseTransfer):
    product = db.get(Product, t.product_id); source = db.get(Warehouse, t.source_warehouse_id); destination = db.get(Warehouse, t.destination_warehouse_id)
    requested_by = db.get(User, t.requested_by_user_id) if t.requested_by_user_id else None
    return {"id": t.id, "product_id": t.product_id, "product": product.name if product else str(t.product_id), "source_warehouse_id": t.source_warehouse_id, "source_warehouse": source.name if source else str(t.source_warehouse_id), "destination_warehouse_id": t.destination_warehouse_id, "destination_warehouse": destination.name if destination else str(t.destination_warehouse_id), "quantity": t.quantity, "status": t.status.name, "requested_by_user_id": t.requested_by_user_id, "requested_by": requested_by.name if requested_by else "Unknown", "reason": t.reason, "created_at": t.created_at, "completed_at": t.completed_at, "destination_approved_by_user_id": t.destination_approved_by_user_id, "source_dispatched_by_user_id": t.source_dispatched_by_user_id, "received_by_user_id": t.received_by_user_id, "destination_approved_at": t.destination_approved_at, "source_dispatched_at": t.source_dispatched_at, "received_at": t.received_at, "rejected_at": t.rejected_at}


@router.get("/transfers")
def transfers(current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    stmt = select(WarehouseTransfer).order_by(WarehouseTransfer.created_at.desc())
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        if assigned_id is None: raise HTTPException(status_code=403, detail="No warehouse is assigned to this manager")
        stmt = stmt.where((WarehouseTransfer.source_warehouse_id == assigned_id) | (WarehouseTransfer.destination_warehouse_id == assigned_id))
    return [_transfer_out(db, t) for t in db.scalars(stmt).all()]


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
def transfer(payload: TransferInput, current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        if assigned_id != payload.source_warehouse_id: raise HTTPException(status_code=403, detail="Managers may only request transfers from their assigned warehouse")
    try:
        tx = request_transfer(db, payload.product_id, payload.source_warehouse_id, payload.destination_warehouse_id, payload.quantity, current.user.id, payload.reason)
        return {"id": tx.id, "status": tx.status.name}
    except TransferError as exc: raise HTTPException(status_code=409, detail=str(exc))


@router.post("/transfers/{transfer_id}/{action}")
def transfer_action(transfer_id: int, action: str, current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    if action not in {"approve", "reject", "dispatch", "receive"}: raise HTTPException(status_code=404, detail="Unknown transfer action")
    transfer_row = db.get(WarehouseTransfer, transfer_id)
    if not transfer_row: raise HTTPException(status_code=404, detail="Transfer request not found")
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        destination_actions = {"approve", "reject", "receive"}
        allowed_warehouse = transfer_row.destination_warehouse_id if action in destination_actions else transfer_row.source_warehouse_id
        if assigned_id != allowed_warehouse: raise HTTPException(status_code=403, detail="This action is restricted to the assigned source or destination warehouse manager")
    try:
        updated = update_transfer(db, transfer_id, action, current.user.id)
        return {"id": updated.id, "status": updated.status.name}
    except TransferError as exc: raise HTTPException(status_code=409, detail=str(exc))


@router.get("/transactions")
def transactions(current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    stmt = select(InventoryTransaction).order_by(InventoryTransaction.created_at.desc()).limit(200)
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        stmt = select(InventoryTransaction).where(InventoryTransaction.warehouse_id == assigned_id).order_by(InventoryTransaction.created_at.desc()).limit(200)
    rows = db.scalars(stmt).all()
    return [{"id": t.id, "type": t.transaction_type, "transaction_type": t.transaction_type, "product_id": t.product_id, "warehouse_id": t.warehouse_id, "quantity": t.quantity, "reference_type": t.reference_type, "reference_id": t.reference_id, "user_id": t.user_id, "created_at": t.created_at} for t in rows]


@router.get("/dashboard")
def dashboard(current: CurrentUser = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)), db: Session = Depends(get_db)):
    inv_stmt = select(func.coalesce(func.sum(Inventory.quantity), 0)); order_stmt = select(func.count()).select_from(Order); wh_stmt = select(func.count()).select_from(Warehouse)
    if current.user.role == UserRole.WAREHOUSE_MANAGER:
        assigned_id = db.scalar(select(Warehouse.id).where(Warehouse.manager_user_id == current.user.id))
        inv_stmt = inv_stmt.where(Inventory.warehouse_id == assigned_id)
        order_stmt = select(func.count()).select_from(Order).where(Order.selected_warehouse_id == assigned_id)
        wh_stmt = select(func.count()).select_from(Warehouse).where(Warehouse.id == assigned_id)
    return {"products": db.scalar(select(func.count()).select_from(Product)), "warehouses": db.scalar(wh_stmt), "orders": db.scalar(order_stmt), "total_stock": db.scalar(inv_stmt)}
