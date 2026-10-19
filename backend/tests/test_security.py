from app.core.security import create_access_token, decode_token, hash_password, verify_password


def test_password_hash_round_trip():
    encoded = hash_password("StrongPassword@123")
    assert encoded != "StrongPassword@123"
    assert verify_password("StrongPassword@123", encoded)
    assert not verify_password("wrong", encoded)


def test_jwt_round_trip():
    token = create_access_token(42, "customer", 7)
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "customer"
    assert payload["customer_id"] == 7
