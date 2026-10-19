from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.entities import Inventory, InventoryTransaction, Product, TransferStatus, User, UserRole, Warehouse, WarehouseTransfer
from app.services.transfers import request_transfer, update_transfer


def build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def test_transfer_requires_approval_dispatch_and_receipt():
    engine = build_session()
    with Session(engine) as db:
        source_manager = User(name="Source", email="source@example.com", password_hash="x", role=UserRole.WAREHOUSE_MANAGER)
        destination_manager = User(name="Destination", email="destination@example.com", password_hash="x", role=UserRole.WAREHOUSE_MANAGER)
        db.add_all([source_manager, destination_manager]); db.flush()
        source_wh = Warehouse(name="Source WH", code="SRC", location="Source", city="City", latitude=Decimal("1"), longitude=Decimal("1"), capacity=100, current_load=10, manager_user_id=source_manager.id)
        destination_wh = Warehouse(name="Destination WH", code="DST", location="Destination", city="City", latitude=Decimal("1"), longitude=Decimal("1"), capacity=100, current_load=10, manager_user_id=destination_manager.id)
        product = Product(sku="TEST-1", name="Test Product", category="Test", price=Decimal("10"))
        db.add_all([source_wh, destination_wh, product]); db.flush()
        db.add_all([Inventory(warehouse_id=source_wh.id, product_id=product.id, quantity=20, reserved_quantity=0), Inventory(warehouse_id=destination_wh.id, product_id=product.id, quantity=2, reserved_quantity=0)])
        db.commit()

        transfer = request_transfer(db, product.id, source_wh.id, destination_wh.id, 5, source_manager.id, "Rebalance stock")
        source_stock = db.scalar(select(Inventory).where(Inventory.warehouse_id == source_wh.id))
        assert transfer.status == TransferStatus.PENDING_DESTINATION_APPROVAL
        assert source_stock.quantity == 20 and source_stock.reserved_quantity == 5

        update_transfer(db, transfer.id, "approve", destination_manager.id)
        update_transfer(db, transfer.id, "dispatch", source_manager.id)
        source_stock = db.scalar(select(Inventory).where(Inventory.warehouse_id == source_wh.id))
        destination_stock = db.scalar(select(Inventory).where(Inventory.warehouse_id == destination_wh.id))
        assert source_stock.quantity == 15 and source_stock.reserved_quantity == 0
        assert destination_stock.quantity == 2  # In-transit stock is not yet available at destination.

        completed = update_transfer(db, transfer.id, "receive", destination_manager.id)
        destination_stock = db.scalar(select(Inventory).where(Inventory.warehouse_id == destination_wh.id))
        assert completed.status == TransferStatus.COMPLETED
        assert destination_stock.quantity == 7
        assert completed.destination_approved_at and completed.source_dispatched_at and completed.received_at
        assert db.scalar(select(InventoryTransaction).where(InventoryTransaction.transaction_type == "TRANSFER_OUT"))
        assert db.scalar(select(InventoryTransaction).where(InventoryTransaction.transaction_type == "TRANSFER_IN"))


def test_rejection_releases_reserved_stock():
    engine = build_session()
    with Session(engine) as db:
        m1 = User(name="Source", email="source2@example.com", password_hash="x", role=UserRole.WAREHOUSE_MANAGER)
        m2 = User(name="Destination", email="destination2@example.com", password_hash="x", role=UserRole.WAREHOUSE_MANAGER)
        db.add_all([m1, m2]); db.flush()
        w1 = Warehouse(name="A", code="A", location="A", city="A", latitude=Decimal("1"), longitude=Decimal("1"), capacity=100, current_load=10, manager_user_id=m1.id)
        w2 = Warehouse(name="B", code="B", location="B", city="B", latitude=Decimal("1"), longitude=Decimal("1"), capacity=100, current_load=10, manager_user_id=m2.id)
        p = Product(sku="TEST-2", name="Test Product 2", category="Test", price=Decimal("10"))
        db.add_all([w1, w2, p]); db.flush()
        db.add_all([Inventory(warehouse_id=w1.id, product_id=p.id, quantity=10, reserved_quantity=0), Inventory(warehouse_id=w2.id, product_id=p.id, quantity=0, reserved_quantity=0)]); db.commit()
        transfer = request_transfer(db, p.id, w1.id, w2.id, 4, m1.id)
        update_transfer(db, transfer.id, "reject", m2.id)
        source = db.scalar(select(Inventory).where(Inventory.warehouse_id == w1.id))
        assert source.quantity == 10 and source.reserved_quantity == 0
        assert db.get(WarehouseTransfer, transfer.id).status == TransferStatus.REJECTED
