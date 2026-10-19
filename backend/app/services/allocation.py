from math import radians, sin, cos, asin, sqrt


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat = radians(float(lat2) - float(lat1))
    dlon = radians(float(lon2) - float(lon1))
    a = sin(dlat / 2) ** 2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def warehouse_score(availability_ratio, priority, distance_km, current_load, capacity):
    # Availability ratio of 5x requested stock is treated as the 100-point ceiling.
    stock_score = min(max(float(availability_ratio), 0) / 5 * 100, 100)
    priority_score = max(0, min(float(priority), 100))
    proximity_score = max(0, 100 - (float(distance_km) / 500 * 100))
    load_ratio = 0 if capacity <= 0 else max(float(current_load), 0) / float(capacity)
    load_score = max(0, 100 - min(load_ratio, 1) * 100)
    final_score = 0.40 * stock_score + 0.25 * priority_score + 0.20 * proximity_score + 0.15 * load_score
    return {"stock_score": round(stock_score, 2), "priority_score": round(priority_score, 2), "proximity_score": round(proximity_score, 2), "load_score": round(load_score, 2), "final_score": round(final_score, 2)}
