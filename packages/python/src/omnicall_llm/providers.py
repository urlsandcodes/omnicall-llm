import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List

PROVIDERS = {
    'gemini': {
        'name': 'gemini',
        'default_model': 'gemini-2.5-flash',
        'default_embedding_model': 'text-embedding-004',
        'env_key': 'GEMINI_API_KEY',
    },
    'groq': {
        'name': 'groq',
        'default_model': 'llama-3.3-70b-versatile',
        'env_key': 'GROQ_API_KEY',
        'base_url': 'https://api.groq.com/openai/v1',
    },
    'sambanova': {
        'name': 'sambanova',
        'default_model': 'Meta-Llama-3.1-70B-Instruct',
        'env_key': 'SAMBANOVA_API_KEY',
        'base_url': 'https://api.sambanova.ai/v1',
    },
    'cerebras': {
        'name': 'cerebras',
        'default_model': 'llama-3.3-70b',
        'env_key': 'CEREBRAS_API_KEY',
        'base_url': 'https://api.cerebras.ai/v1',
    },
    'openrouter': {
        'name': 'openrouter',
        'default_model': 'meta-llama/llama-3.3-70b-instruct:free',
        'env_key': 'OPENROUTER_API_KEY',
        'base_url': 'https://openrouter.ai/api/v1',
    },
    'mistral': {
        'name': 'mistral',
        'default_model': 'mistral-large-latest',
        'default_embedding_model': 'mistral-embed',
        'env_key': 'MISTRAL_API_KEY',
        'base_url': 'https://api.mistral.ai/v1',
    },
    'openai': {
        'name': 'openai',
        'default_model': 'gpt-4o-mini',
        'default_embedding_model': 'text-embedding-3-small',
        'env_key': 'OPENAI_API_KEY',
        'base_url': 'https://api.openai.com/v1',
    },
    'huggingface': {
        'name': 'huggingface',
        'default_embedding_model': 'sentence-transformers/all-MiniLM-L6-v2',
        'env_key': 'HUGGINGFACE_API_KEY',
        'base_url': 'https://api-inference.huggingface.co/pipeline/feature-extraction',
    },
    'cohere': {
        'name': 'cohere',
        'default_embedding_model': 'embed-english-v3.0',
        'env_key': 'COHERE_API_KEY',
        'base_url': 'https://api.cohere.ai/v1',
    },
    'jina': {
        'name': 'jina',
        'default_embedding_model': 'jina-embeddings-v2-base-en',
        'env_key': 'JINA_API_KEY',
        'base_url': 'https://api.jina.ai/v1',
    },
}

def call_provider_api(
    provider: str,
    model: str,
    prompt: str,
    api_key: str,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None
) -> Dict[str, Any]:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    if provider == 'gemini':
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ]
        }
        
        generation_config = {}
        if temperature is not None:
            generation_config["temperature"] = temperature
        if max_tokens is not None:
            generation_config["maxOutputTokens"] = max_tokens
        if generation_config:
            body["generationConfig"] = generation_config

        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"Gemini API error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"Gemini API calling failed: {str(e)}")

        candidates = data.get("candidates", [])
        if not candidates:
            raise Exception(f"Invalid or empty response from Gemini: {json.dumps(data)}")
        
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise Exception(f"Invalid or empty response from Gemini: {json.dumps(data)}")

        text = parts[0].get("text")
        if text is None:
            raise Exception(f"Invalid or empty response from Gemini: {json.dumps(data)}")

        usage_meta = data.get("usageMetadata", {})
        prompt_tokens = usage_meta.get("promptTokenCount", 0)
        completion_tokens = usage_meta.get("candidatesTokenCount", 0)

        return {
            "text": text,
            "usage": {
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "totalTokens": prompt_tokens + completion_tokens
            }
        }

    else:
        # OpenAI compatible providers
        base_url = config.get("base_url")
        if not base_url:
            raise ValueError(f"Missing base URL for OpenAI-compatible provider: {provider}")

        url = f"{base_url}/chat/completions"
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        if provider == 'openrouter':
            headers["HTTP-Referer"] = "https://github.com/omnicall-llm/omnicall"
            headers["X-Title"] = "Omnicall LLM"

        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers=headers,
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"{provider} API error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"{provider} API calling failed: {str(e)}")

        choices = data.get("choices", [])
        if not choices:
            raise Exception(f"Invalid or empty response from {provider}: {json.dumps(data)}")

        text = choices[0].get("message", {}).get("content")
        if text is None:
            raise Exception(f"Invalid or empty response from {provider}: {json.dumps(data)}")

        usage = data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        return {
            "text": text,
            "usage": {
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "totalTokens": prompt_tokens + completion_tokens
            }
        }

def call_embedding_api(
    provider: str,
    model: str,
    prompt: str,
    api_key: str
) -> List[float]:
    config = PROVIDERS.get(provider)
    if not config:
        raise ValueError(f"Unsupported provider: {provider}")

    if provider == 'gemini':
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
        body = {
            "content": {
                "parts": [{"text": prompt}]
            }
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"Gemini Embedding API error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"Gemini Embedding API calling failed: {str(e)}")

        embedding = data.get("embedding", {}).get("values")
        if not embedding or not isinstance(embedding, list):
            raise Exception(f"Invalid embedding response from Gemini: {json.dumps(data)}")
        return embedding

    elif provider == 'huggingface':
        base_url = config.get("base_url")
        url = f"{base_url}/{model}"
        body = {
            "inputs": prompt,
            "options": { "wait_for_model": True }
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"Hugging Face Embedding error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"Hugging Face Embedding calling failed: {str(e)}")

        embedding = data[0] if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list) else data
        if not isinstance(embedding, list) or not all(isinstance(x, (int, float)) for x in embedding):
            raise Exception(f"Invalid embedding response from Hugging Face: {json.dumps(data)}")
        return embedding

    elif provider == 'cohere':
        base_url = config.get("base_url")
        url = f"{base_url}/embed"
        body = {
            "model": model,
            "texts": [prompt],
            "input_type": "search_document"
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"Cohere Embedding error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"Cohere Embedding calling failed: {str(e)}")

        embeddings = data.get("embeddings")
        if not embeddings or not isinstance(embeddings, list) or len(embeddings) == 0:
            raise Exception(f"Invalid embedding response from Cohere: {json.dumps(data)}")
        return embeddings[0]

    else:
        # OpenAI, Jina AI, or other OpenAI-compatible embedding formats
        base_url = config.get("base_url")
        if not base_url:
            raise ValueError(f"Missing base URL for provider: {provider}")

        url = f"{base_url}/embeddings"
        body = {
            "model": model,
            "input": prompt
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_text = e.read().decode('utf-8')
            raise Exception(f"{provider} Embedding error (HTTP {e.code}): {error_text}")
        except Exception as e:
            raise Exception(f"{provider} Embedding calling failed: {str(e)}")

        data_list = data.get("data", [])
        if not data_list or not isinstance(data_list, list):
            raise Exception(f"Invalid embedding response from {provider}: {json.dumps(data)}")
        
        embedding = data_list[0].get("embedding")
        if not embedding or not isinstance(embedding, list):
            raise Exception(f"Invalid embedding response from {provider}: {json.dumps(data)}")
        return embedding
