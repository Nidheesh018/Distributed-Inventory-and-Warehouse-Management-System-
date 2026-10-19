from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.entities import Customer, User, UserRole

bearer = HTTPBearer(auto_error=False)

@dataclass
class CurrentUser:
    user: User
    customer_id: int | None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    customer_id = db.scalar(select(Customer.id).where(Customer.user_id == user.id))
    return CurrentUser(user=user, customer_id=customer_id)


def require_roles(*roles: UserRole):
    def dependency(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current.user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current
    return dependency
