import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any

# --- Configuration ---
NUM_COWS = 20
NUM_DAYS = 90
READINGS_PER_DAY = 4  # Every 6 hours

# --- Helper to generate realistic baselines ---
def generate_cow_profile(cow_index: int) -> Dict[str, Any]:
    """Generate realistic baseline EC and Temp for a cow."""
    # Holstein Friesian / Crossbreed typical ranges
    # EC: 3.5 to 5.0 mS/cm (normal), Temp: 38.0 to 39.0 degrees C
    baseline_ec = round(random.uniform(3.8, 4.8), 2)
    baseline_temp = round(random.uniform(38.2, 38.8), 1)
    # VTU Regional Centre, Mysuru (Hanchya Sathagalli); jitter within about 1 km.
    latitude = round(12.325333 + random.uniform(-0.01, 0.01), 6)
    longitude = round(76.699547 + random.uniform(-0.01, 0.01), 6)
    
    # Assign breeds cyclically for variety
    breeds = ["Holstein Friesian", "Jersey", "Sahiwal", "Gir", "Crossbreed"]
    
    return {
        "tag_number": f"COW-{100 + cow_index}",
        "breed": breeds[cow_index % len(breeds)],
        "birth_date": (datetime.now() - timedelta(days=random.randint(400, 2000))).date().isoformat(),
        "lactation_number": random.randint(1, 5),
        "previous_mastitis_count": random.randint(0, 2),
        "baseline_ec": baseline_ec,
        "baseline_temp": baseline_temp,
        "latitude": latitude,
        "longitude": longitude,
    }

def generate_time_series(animal_id: str, baseline_ec: float, baseline_temp: float) -> List[Dict[str, Any]]:
    """
    Generates 90 days of readings.
    Simulates 5 cows getting progressively riskier towards day 90.
    """
    readings = []
    start_date = datetime.now() - timedelta(days=NUM_DAYS)
    
    # Determine if this cow will develop mastitis risk (approx 25-30% prevalence)
    # We'll assign a "risk_factor" (0 = healthy, 1 = high risk)
    risk_factor = random.random()
    is_high_risk = risk_factor < 0.25  # 5 out of 20 cows
    
    for day in range(NUM_DAYS):
        # Daily fluctuation (circadian rhythm)
        for reading_idx in range(READINGS_PER_DAY):
            # Time of day: morning, noon, evening, night
            hour = 6 + (reading_idx * 6)
            reading_time = start_date + timedelta(days=day, hours=hour)
            
            # --- EC Simulation ---
            # Base variation (+/- 0.3 mS/cm)
            ec_noise = random.gauss(0, 0.15)
            ec_value = baseline_ec + ec_noise
            
            # If high risk cow, gradually increase EC starting from day 60 to day 90
            if is_high_risk and day > 60:
                progress = (day - 60) / 30  # 0 to 1
                # Increase EC by up to 2.0 mS/cm, simulating mastitis onset
                ec_value += progress * random.uniform(1.5, 2.5)
                # Add extra spike noise
                if random.random() < 0.1:  # 10% chance of spike
                    ec_value += random.uniform(0.3, 0.8)
            
            # --- Temperature Simulation ---
            temp_noise = random.gauss(0, 0.1)
            temp_value = baseline_temp + temp_noise
            
            # If high risk, temperature rises (especially after day 75)
            if is_high_risk and day > 75:
                progress = (day - 75) / 15
                temp_value += progress * random.uniform(0.5, 1.0)
            
            # Clamp to realistic ranges
            ec_value = max(2.0, min(8.0, ec_value))
            temp_value = max(37.0, min(41.0, temp_value))
            
            # Append EC Reading
            readings.append({
                "animal_id": animal_id,
                "sensor_type": "EC",
                "value": round(ec_value, 3),
                "unit": "mS/cm",
                "reading_time": reading_time.isoformat(),
                "is_simulated": True,
                "device_id": "SIMULATOR"
            })
            
            # Append Temp Reading
            readings.append({
                "animal_id": animal_id,
                "sensor_type": "TEMP",
                "value": round(temp_value, 2),
                "unit": "C",
                "reading_time": reading_time.isoformat(),
                "is_simulated": True,
                "device_id": "SIMULATOR"
            })
            
    return readings
