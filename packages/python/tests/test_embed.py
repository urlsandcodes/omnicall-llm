import unittest
from unittest.mock import patch, MagicMock
import urllib.error
import io
import json
import os
import sys

# Add packages/python/src to sys.path so we can import omnicall_llm directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from omnicall_llm import OmniEmbed

class TestOmniEmbed(unittest.TestCase):
    @patch('urllib.request.urlopen')
    def test_fallback_logic_works_on_failure(self, mock_urlopen):
        # First call (huggingface) fails
        fp = io.BytesIO(b"Hugging Face server busy")
        http_error = urllib.error.HTTPError(
            url="https://api-inference.huggingface.co/...",
            code=503,
            msg="Service Unavailable",
            hdrs={},
            fp=fp
        )
        
        # Second call (openai) succeeds
        mock_response = MagicMock()
        mock_response.__enter__.return_value = mock_response
        mock_response.read.return_value = json.dumps({
            "data": [{
                "embedding": [0.4, 0.5, 0.6]
            }]
        }).encode('utf-8')
        
        mock_urlopen.side_effect = [http_error, mock_response]
        
        embedder = OmniEmbed(
            api_keys={
                "huggingface": "fake-hf-key",
                "openai": "fake-openai-key"
            }
        )
        
        response = embedder.embed("test query")
        
        self.assertTrue(response.success)
        self.assertEqual(response.provider, "openai")
        self.assertEqual(response.embedding, [0.4, 0.5, 0.6])
        self.assertEqual(response.dimensions, 3)
        self.assertEqual(len(response.errors), 1)
        self.assertIn("Hugging Face Embedding error", response.errors[0]["error"])

if __name__ == '__main__':
    unittest.main()
