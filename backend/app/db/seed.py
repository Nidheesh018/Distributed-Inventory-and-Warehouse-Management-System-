from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import Customer, Inventory, Product, User, UserRole, Warehouse


def seed_database(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return

    admin = User(name="System Admin", email="admin@example.com", password_hash=hash_password("Admin@12345"), role=UserRole.ADMIN)
    customer_user_1 = User(name="Customer One", email="customer1@example.com", password_hash=hash_password("Customer@12345"), role=UserRole.CUSTOMER)
    customer_user_2 = User(name="Customer Two", email="customer2@example.com", password_hash=hash_password("Customer@12345"), role=UserRole.CUSTOMER)
    owner = User(name="Company Owner", email="owner@example.com", password_hash=hash_password("Owner@12345"), role=UserRole.OWNER)
    managers = [
        User(name="Aarav Sharma", email="manager.hyd@example.com", password_hash=hash_password("Manager@12345"), role=UserRole.WAREHOUSE_MANAGER),
        User(name="Isha Reddy", email="manager.blr@example.com", password_hash=hash_password("Manager@12345"), role=UserRole.WAREHOUSE_MANAGER),
        User(name="Kabir Mehta", email="manager.mum@example.com", password_hash=hash_password("Manager@12345"), role=UserRole.WAREHOUSE_MANAGER),
        User(name="Ananya Rao", email="manager.del@example.com", password_hash=hash_password("Manager@12345"), role=UserRole.WAREHOUSE_MANAGER),
    ]
    db.add_all([admin, owner, customer_user_1, customer_user_2, *managers])
    db.flush()

    db.add_all([
        Customer(user_id=customer_user_1.id, address="Madhapur", city="Hyderabad", latitude=Decimal("17.4483"), longitude=Decimal("78.3915")),
        Customer(user_id=customer_user_2.id, address="Dilsukhnagar", city="Hyderabad", latitude=Decimal("17.3688"), longitude=Decimal("78.5247")),
    ])
    warehouses = [
        Warehouse(name="Central Hyderabad Warehouse", code="WH-HYD-01", location="Kukatpally", city="Hyderabad", latitude=Decimal("17.4948"), longitude=Decimal("78.3996"), priority=90, capacity=1500, current_load=350),
        Warehouse(name="East Hyderabad Warehouse", code="WH-HYD-02", location="Uppal", city="Hyderabad", latitude=Decimal("17.4058"), longitude=Decimal("78.5591"), priority=80, capacity=1300, current_load=520),
        Warehouse(name="South Hyderabad Warehouse", code="WH-HYD-03", location="Shamshabad", city="Hyderabad", latitude=Decimal("17.2403"), longitude=Decimal("78.4294"), priority=75, capacity=1700, current_load=420),
        Warehouse(name="North Hyderabad Warehouse", code="WH-HYD-04", location="Medchal", city="Hyderabad", latitude=Decimal("17.6300"), longitude=Decimal("78.4814"), priority=70, capacity=1200, current_load=610),
    ]
    for wh, manager_user in zip(warehouses, managers): wh.manager_user_id = manager_user.id
    db.add_all(warehouses)

    specs = [
        ("ELEC-001","Laptop","Electronics",65000,5),("ELEC-002","Wireless Mouse","Electronics",1200,10),
        ("ELEC-003","Mechanical Keyboard","Electronics",4500,8),("OFF-001","Office Chair","Office",8500,4),
        ("OFF-002","Desk Lamp","Office",1800,6),("ACC-001","USB-C Hub","Accessories",2500,10),
        ("ACC-002","Laptop Stand","Accessories",2200,8),("HOME-001","Air Purifier","Home",12000,3),
        ("HOME-002","Smart Plug","Home",1400,12),("ELEC-004","Monitor","Electronics",14500,5),
        ("OFF-003","Whiteboard","Office",3200,3),("ACC-003","Webcam","Accessories",3000,7),
        ("ELEC-005","Router","Electronics",3500,6),("HOME-003","Extension Board","Home",900,15),
        ("OFF-004","Document Scanner","Office",18000,2),
    ]
    products = [Product(sku=a, name=b, description=f"{b} demo product", category=c, price=Decimal(str(d)), reorder_level=e) for a,b,c,d,e in specs]
    db.add_all(products)
    db.flush()

    for wi, wh in enumerate(warehouses, 1):
        for pi, product in enumerate(products, 1):
            qty = 10 + pi if wi == 1 else 5 + pi * 2 if wi == 2 else 20 + pi if wi == 3 else 8 + pi
            db.add(Inventory(warehouse_id=wh.id, product_id=product.id, quantity=qty, reserved_quantity=0))

    db.commit()


def ensure_role_accounts(db: Session) -> None:
    """Idempotently provision an owner and one manager per existing warehouse."""
    owner_email = "owner@example.com"
    if not db.scalar(select(User.id).where(User.email == owner_email)):
        db.add(User(name="Company Owner", email=owner_email, password_hash=hash_password("Owner@12345"), role=UserRole.OWNER))
    manager_specs = [
        ("Aarav Sharma", "manager.hyd@example.com"),
        ("Isha Reddy", "manager.blr@example.com"),
        ("Kabir Mehta", "manager.mum@example.com"),
        ("Ananya Rao", "manager.del@example.com"),
    ]
    for name, email in manager_specs:
        if not db.scalar(select(User.id).where(User.email == email)):
            db.add(User(name=name, email=email, password_hash=hash_password("Manager@12345"), role=UserRole.WAREHOUSE_MANAGER))
    db.flush()
    warehouses = db.scalars(select(Warehouse).order_by(Warehouse.id)).all()
    managers = [db.scalar(select(User).where(User.email == email)) for _, email in manager_specs]
    for wh, manager in zip(warehouses, managers):
        if manager and wh.manager_user_id is None:
            # Keep a valid existing assignment if already configured; only fill unassigned warehouses.
            wh.manager_user_id = manager.id
    db.commit()
