import unittest

from pydantic import ValidationError

from app.api.readings import SensorReadingInput


class SensorReadingInputTests(unittest.TestCase):
    def test_accepts_valid_temperature(self):
        reading = SensorReadingInput(
            animal_id="cow-1",
            sensor_type="TEMP",
            value=38.7,
            unit="C",
            device_id="device-1",
        )
        self.assertEqual(reading.sensor_type, "TEMP")

    def test_rejects_out_of_range_temperature(self):
        with self.assertRaises(ValidationError):
            SensorReadingInput(
                animal_id="cow-1",
                sensor_type="TEMP",
                value=60,
                unit="C",
                device_id="device-1",
            )

    def test_rejects_unknown_sensor_type(self):
        with self.assertRaises(ValidationError):
            SensorReadingInput(
                animal_id="cow-1",
                sensor_type="SCC",
                value=100,
                unit="cells/ml",
                device_id="device-1",
            )


if __name__ == "__main__":
    unittest.main()
