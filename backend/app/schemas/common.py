from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    role: str
    customer_id: int | None = None
    warehouse_id: int | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class OrderItemInput(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100000)


class CreateOrderInput(BaseModel):
    customer_id: int | None = Field(default=None, gt=0)
    items: list[OrderItemInput] = Field(min_length=1, max_length=50)


class TransferInput(BaseModel):
    product_id: int = Field(gt=0)
    source_warehouse_id: int = Field(gt=0)
    destination_warehouse_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100000)
    reason: str | None = Field(default=None, max_length=500)


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(ge=0)
    reorder_level: int = Field(default=5, ge=0)
    description: str | None = Field(default=None, max_length=2000)
    initial_stock: dict[int, int] = Field(default_factory=dict)


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    price: Decimal
    reorder_level: int


class OrderOut(BaseModel):
    id: int
    customer_id: int
    status: str
    total_amount: Decimal
    selected_warehouse_id: int | None
    created_at: datetime
