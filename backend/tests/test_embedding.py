import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services import embedding


class EmbeddingSettingsTests(unittest.TestCase):
    def tearDown(self):
        embedding.get_embedding_model.cache_clear()

    def test_embedding_model_is_not_loaded_when_embeddings_are_disabled(self):
        embedding.get_embedding_model.cache_clear()
        fake_module = types.ModuleType("sentence_transformers")

        class FakeSentenceTransformer:
            def __init__(self, *args, **kwargs):
                raise AssertionError("model loader should not be called when embeddings are disabled")

        fake_module.SentenceTransformer = FakeSentenceTransformer
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}), patch(
            "app.services.embedding.get_settings",
            return_value=SimpleNamespace(embedding_enabled=False),
        ):
            self.assertIsNone(embedding.get_embedding_model())

    def test_embedding_model_loads_with_downloads_allowed(self):
        embedding.get_embedding_model.cache_clear()
        calls = []
        fake_module = types.ModuleType("sentence_transformers")

        class FakeSentenceTransformer:
            def __init__(self, model_name, **kwargs):
                calls.append((model_name, kwargs))

        fake_module.SentenceTransformer = FakeSentenceTransformer
        settings = SimpleNamespace(
            embedding_enabled=True,
            embedding_model="BAAI/bge-m3",
            embedding_local_files_only=False,
        )
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}), patch(
            "app.services.embedding.importlib.util.find_spec", return_value=True
        ), patch("app.services.embedding.get_settings", return_value=settings):
            self.assertIsNotNone(embedding.get_embedding_model())

        self.assertEqual(calls, [("BAAI/bge-m3", {"local_files_only": False})])

    def test_embedding_model_honors_local_files_only(self):
        embedding.get_embedding_model.cache_clear()
        calls = []
        fake_module = types.ModuleType("sentence_transformers")

        class FakeSentenceTransformer:
            def __init__(self, model_name, **kwargs):
                calls.append((model_name, kwargs))

        fake_module.SentenceTransformer = FakeSentenceTransformer
        settings = SimpleNamespace(
            embedding_enabled=True,
            embedding_model="/models/bge-m3",
            embedding_local_files_only=True,
        )
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}), patch(
            "app.services.embedding.importlib.util.find_spec", return_value=True
        ), patch("app.services.embedding.get_settings", return_value=settings):
            self.assertIsNotNone(embedding.get_embedding_model())

        self.assertEqual(calls, [("/models/bge-m3", {"local_files_only": True})])


if __name__ == "__main__":
    unittest.main()
