import unittest
from unittest.mock import patch, MagicMock
import urllib.error
import io
import json
import os
import sys

# Add packages/python/src to sys.path so we can import omnicall_llm directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from omnicall_llm import OmniCall

class TestOmniCall(unittest.TestCase):
    @patch('urllib.request.urlopen')
    def test_fallback_logic_works_on_failure(self, mock_urlopen):
        # First call (gemini) fails
        fp = io.BytesIO(b"Gemini quota exceeded")
        http_error = urllib.error.HTTPError(
            url="https://generativelanguage.googleapis.com/...",
            code=429,
            msg="Too Many Requests",
            hdrs={},
            fp=fp
        )
        
        # Second call (groq) succeeds
        mock_response = MagicMock()
        mock_response.__enter__.return_value = mock_response
        mock_response.read.return_value = json.dumps({
            "choices": [{
                "message": {
                    "content": "Hello from Groq Mock!"
                }
            }],
            "usage": {
                "prompt_tokens": 12,
                "completion_tokens": 8
            }
        }).encode('utf-8')
        
        mock_urlopen.side_effect = [http_error, mock_response]
        
        client = OmniCall(
            api_keys={
                "gemini": "fake-gemini-key",
                "groq": "fake-groq-key"
            }
        )
        
        response = client.generate("test prompt")
        
        self.assertTrue(response.success)
        self.assertEqual(response.provider, "groq")
        self.assertEqual(response.text, "Hello from Groq Mock!")
        self.assertEqual(len(response.errors), 1)
        self.assertIn("Gemini API error", response.errors[0]["error"])
        
    @patch('urllib.request.urlopen')
    def test_all_providers_fail(self, mock_urlopen):
        fp = io.BytesIO(b"Internal Server Error")
        http_error = urllib.error.HTTPError(
            url="...",
            code=500,
            msg="Internal Error",
            hdrs={},
            fp=fp
        )
        mock_urlopen.side_effect = [http_error, http_error]
        
        client = OmniCall(
            api_keys={
                "gemini": "fake-gemini-key",
                "groq": "fake-groq-key"
            },
            default_fallback_order=["gemini", "groq"]
        )
        
        response = client.generate("test prompt")
        self.assertFalse(response.success)
        self.assertEqual(len(response.errors), 2)
        self.assertIn("Gemini API error", response.errors[0]["error"])
        self.assertIn("groq API error", response.errors[1]["error"])

if __name__ == '__main__':
    unittest.main()
