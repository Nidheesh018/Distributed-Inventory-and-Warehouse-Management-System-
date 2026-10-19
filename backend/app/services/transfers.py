from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import Inventory, InventoryTransaction, TransferStatus, Warehouse, WarehouseTransfer

class TransferError(Exception):
    pass

def request_transfer(db: Session, product_id: int, source_warehouse_id: int, destination_warehouse_id: int, quantity: int, actor_user_id: int, reason: str | None = None):
    if source_warehouse_id == destination_warehouse_id:
        raise TransferError("Source and destination warehouses must be different")
    if quantity <= 0:
        raise TransferError("Transfer quantity must be positive")
    try:
        ids = sorted([source_warehouse_id, destination_warehouse_id])
        warehouses = db.scalars(select(Warehouse).where(Warehouse.id.in_(ids)).order_by(Warehouse.id)).all()
        if len(warehouses) != 2:
            raise TransferError("Source or destination warehouse does not exist")
        rows = db.scalars(select(Inventory).where(Inventory.product_id == product_id, Inventory.warehouse_id.in_(ids)).order_by(Inventory.warehouse_id).with_for_update()).all()
        by_wh = {r.warehouse_id:r for r in rows}
        source, destination = by_wh.get(source_warehouse_id), by_wh.get(destination_warehouse_id)
        if not source or not destination:
            raise TransferError("Inventory row missing for one or both warehouses")
        if source.quantity - source.reserved_quantity < quantity:
            raise TransferError("Insufficient available stock in source warehouse")
        source.reserved_quantity += quantity
        transfer = WarehouseTransfer(product_id=product_id, source_warehouse_id=source_warehouse_id, destination_warehouse_id=destination_warehouse_id, quantity=quantity, status=TransferStatus.PENDING_DESTINATION_APPROVAL, requested_by_user_id=actor_user_id, reason=(reason or "Stock balancing").strip()[:500])
        db.add(transfer); db.commit(); db.refresh(transfer); return transfer
    except TransferError:
        db.rollback(); raise
    except Exception as exc:
        db.rollback(); raise TransferError("Transfer request could not be created safely") from exc

def update_transfer(db: Session, transfer_id: int, action: str, actor_user_id: int):
    try:
        transfer = db.scalar(select(WarehouseTransfer).where(WarehouseTransfer.id == transfer_id).with_for_update())
        if not transfer: raise TransferError("Transfer request not found")
        if action == "approve":
            if transfer.status != TransferStatus.PENDING_DESTINATION_APPROVAL: raise TransferError("Transfer is not awaiting destination approval")
            transfer.status = TransferStatus.PENDING_SOURCE_DISPATCH; transfer.destination_approved_by_user_id = actor_user_id; transfer.destination_approved_at = datetime.utcnow()
        elif action == "reject":
            if transfer.status != TransferStatus.PENDING_DESTINATION_APPROVAL: raise TransferError("Only requests awaiting approval can be rejected")
            source = db.scalar(select(Inventory).where(Inventory.product_id==transfer.product_id, Inventory.warehouse_id==transfer.source_warehouse_id).with_for_update())
            if source: source.reserved_quantity = max(0, source.reserved_quantity-transfer.quantity)
            transfer.status = TransferStatus.REJECTED; transfer.rejected_by_user_id = actor_user_id; transfer.rejected_at = datetime.utcnow()
        elif action == "dispatch":
            if transfer.status != TransferStatus.PENDING_SOURCE_DISPATCH: raise TransferError("Transfer must be approved before dispatch")
            source = db.scalar(select(Inventory).where(Inventory.product_id==transfer.product_id, Inventory.warehouse_id==transfer.source_warehouse_id).with_for_update())
            if not source or source.reserved_quantity < transfer.quantity or source.quantity < transfer.quantity: raise TransferError("Reserved stock is no longer available; contact the administrator")
            source.quantity -= transfer.quantity; source.reserved_quantity -= transfer.quantity
            transfer.status = TransferStatus.IN_TRANSIT; transfer.source_dispatched_by_user_id = actor_user_id; transfer.source_dispatched_at = datetime.utcnow()
            db.add(InventoryTransaction(transaction_type="TRANSFER_OUT", product_id=transfer.product_id, warehouse_id=transfer.source_warehouse_id, quantity=-transfer.quantity, reference_type="warehouse_transfer", reference_id=transfer.id, user_id=actor_user_id))
        elif action == "receive":
            if transfer.status != TransferStatus.IN_TRANSIT: raise TransferError("Transfer must be dispatched before receipt can be confirmed")
            destination = db.scalar(select(Inventory).where(Inventory.product_id==transfer.product_id, Inventory.warehouse_id==transfer.destination_warehouse_id).with_for_update())
            if not destination: raise TransferError("Destination inventory row is missing")
            destination.quantity += transfer.quantity
            transfer.status = TransferStatus.COMPLETED; transfer.received_by_user_id = actor_user_id; transfer.received_at = datetime.utcnow(); transfer.completed_at = transfer.received_at
            db.add(InventoryTransaction(transaction_type="TRANSFER_IN", product_id=transfer.product_id, warehouse_id=transfer.destination_warehouse_id, quantity=transfer.quantity, reference_type="warehouse_transfer", reference_id=transfer.id, user_id=actor_user_id))
        else: raise TransferError("Unsupported transfer action")
        db.commit(); db.refresh(transfer); return transfer
    except TransferError:
        db.rollback(); raise
    except Exception as exc:
        db.rollback(); raise TransferError("Transfer action could not be completed safely") from exc
