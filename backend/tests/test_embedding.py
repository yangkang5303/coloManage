import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

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
            return_value=SimpleNamespace(embedding_enabled=False, embedding_provider="local"),
        ):
            self.assertIsNone(embedding.get_embedding_model())

    def test_embedding_model_loads_qwen_with_downloads_allowed(self):
        embedding.get_embedding_model.cache_clear()
        calls = []
        fake_module = types.ModuleType("sentence_transformers")

        class FakeSentenceTransformer:
            def __init__(self, model_name, **kwargs):
                calls.append((model_name, kwargs))

        fake_module.SentenceTransformer = FakeSentenceTransformer
        settings = SimpleNamespace(
            embedding_enabled=True,
            embedding_provider="local",
            embedding_model="Qwen/Qwen3-Embedding-0.6B",
            embedding_local_files_only=False,
        )
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}), patch(
            "app.services.embedding.importlib.util.find_spec", return_value=True
        ), patch("app.services.embedding.get_settings", return_value=settings):
            self.assertIsNotNone(embedding.get_embedding_model())

        self.assertEqual(calls, [("Qwen/Qwen3-Embedding-0.6B", {"local_files_only": False})])

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
            embedding_provider="local",
            embedding_model="/models/qwen3-embedding",
            embedding_local_files_only=True,
        )
        with patch.dict(sys.modules, {"sentence_transformers": fake_module}), patch(
            "app.services.embedding.importlib.util.find_spec", return_value=True
        ), patch("app.services.embedding.get_settings", return_value=settings):
            self.assertIsNotNone(embedding.get_embedding_model())

        self.assertEqual(calls, [("/models/qwen3-embedding", {"local_files_only": True})])

    def test_openai_provider_calls_embeddings_endpoint_and_normalizes(self):
        settings = SimpleNamespace(
            embedding_enabled=True,
            embedding_provider="openai",
            embedding_model="text-embedding-3-small",
            embedding_api_key="test-key",
            embedding_base_url="https://api.openai.com/v1",
            embedding_timeout_seconds=30,
        )
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"data": [{"index": 0, "embedding": [3.0, 4.0]}]}
        client = Mock()
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)
        client.post.return_value = response

        with patch("app.services.embedding.get_settings", return_value=settings), patch(
            "app.services.embedding.httpx.Client", return_value=client
        ):
            vectors = embedding.generate_embeddings(["hello"])

        self.assertAlmostEqual(vectors[0][0], 0.6, places=5)
        self.assertAlmostEqual(vectors[0][1], 0.8, places=5)
        client.post.assert_called_once()


if __name__ == "__main__":
    unittest.main()
