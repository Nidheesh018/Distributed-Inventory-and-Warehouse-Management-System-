import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OWNER = "owner"
    WAREHOUSE_MANAGER = "warehouse_manager"
    CUSTOMER = "customer"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ALLOCATED = "allocated"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class TransferStatus(str, enum.Enum):
    PENDING = "pending"
    PENDING_DESTINATION_APPROVAL = "pending_destination_approval"
    PENDING_SOURCE_DISPATCH = "pending_source_dispatch"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 6))


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(30), unique=True)
    location: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    priority: Mapped[int] = mapped_column(Integer, default=50)
    capacity: Mapped[int] = mapped_column(Integer, default=1000)
    current_load: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="active")
    manager_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True)

    __table_args__ = (
        CheckConstraint("priority >= 0 AND priority <= 100", name="ck_warehouse_priority"),
        CheckConstraint("capacity > 0", name="ck_warehouse_capacity"),
        CheckConstraint("current_load >= 0 AND current_load <= capacity", name="ck_warehouse_load"),
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    reorder_level: Mapped[int] = mapped_column(Integer, default=5)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_product_price"),
        CheckConstraint("reorder_level >= 0", name="ck_product_reorder"),
    )


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_inventory_warehouse_product"),
        CheckConstraint("quantity >= 0", name="ck_inventory_quantity_nonnegative"),
        CheckConstraint("reserved_quantity >= 0", name="ck_inventory_reserved_nonnegative"),
        CheckConstraint("reserved_quantity <= quantity", name="ck_inventory_reserved_not_over_quantity"),
        Index("ix_inventory_product_warehouse", "product_id", "warehouse_id"),
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"), default=OrderStatus.PENDING)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    selected_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_order_item_quantity"),)


class WarehouseTransfer(Base):
    __tablename__ = "warehouse_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    source_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    destination_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[TransferStatus] = mapped_column(Enum(TransferStatus, name="transfer_status"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    destination_approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_dispatched_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rejected_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    destination_approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_dispatched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_transfer_quantity"),
        CheckConstraint("source_warehouse_id <> destination_warehouse_id", name="ck_transfer_distinct_warehouses"),
        Index("ix_transfer_product_created", "product_id", "created_at"),
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_type: Mapped[str] = mapped_column(String(50))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    reference_type: Mapped[str] = mapped_column(String(50))
    reference_id: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("quantity <> 0", name="ck_inventory_transaction_nonzero"),
        Index("ix_inventory_tx_warehouse_created", "warehouse_id", "created_at"),
    )


class AllocationDecision(Base):
    __tablename__ = "allocation_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    stock_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    priority_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    proximity_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    load_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    final_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    selected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
