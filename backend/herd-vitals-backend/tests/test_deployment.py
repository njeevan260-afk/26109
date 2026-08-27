import unittest

from app.core.cors import LOCAL_DEVELOPMENT_ORIGINS, get_cors_origins


class DeploymentConfigurationTests(unittest.TestCase):
    def test_local_origins_are_available_by_default(self):
        self.assertEqual(get_cors_origins(""), list(LOCAL_DEVELOPMENT_ORIGINS))

    def test_adds_and_normalizes_production_origins(self):
        origins = get_cors_origins(
            " https://herd-vitals.vercel.app/, https://preview.example.com "
        )
        self.assertIn("https://herd-vitals.vercel.app", origins)
        self.assertIn("https://preview.example.com", origins)

    def test_removes_duplicate_origins(self):
        origins = get_cors_origins(
            "http://localhost:3000,https://herd-vitals.vercel.app,"
            "https://herd-vitals.vercel.app"
        )
        self.assertEqual(origins.count("http://localhost:3000"), 1)
        self.assertEqual(origins.count("https://herd-vitals.vercel.app"), 1)


if __name__ == "__main__":
    unittest.main()
