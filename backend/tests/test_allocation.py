from app.services.allocation import haversine_km, warehouse_score


def test_score_is_bounded():
    score = warehouse_score(5, 100, 0, 0, 1000)
    assert score["stock_score"] == 100
    assert score["final_score"] == 100


def test_score_prefers_low_load_and_high_priority():
    good = warehouse_score(3, 90, 10, 100, 1000)
    bad = warehouse_score(3, 50, 100, 900, 1000)
    assert good["final_score"] > bad["final_score"]


def test_haversine_same_point_is_zero():
    assert haversine_km(17.4, 78.4, 17.4, 78.4) == 0
