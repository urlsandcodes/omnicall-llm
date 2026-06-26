# Omnicall LLM

A unified, lightweight LLM caller library implemented for both **Node.js (TypeScript/ESM/CJS)** and **Python**. It simplifies integrating LLMs from multiple hosting providers and provides built-in, sequential fallback orchestration.

If one provider fails (due to rate limits, server errors, or invalid keys), it automatically catches the error and falls back to the next provider in the chain.

---

## Features

- **Multi-Provider Support**: Out-of-the-box integration for:
  - Google Gemini (AI Studio)
  - Groq
  - SambaNova Cloud
  - Cerebras Inference
  - OpenRouter
  - Mistral AI
  - OpenAI
- **Automatic Fallback Routing**: If a call fails, it automatically falls back to the next available provider.
- **Environment Key Auto-Detection**: Uses default model settings and detects available keys in your environment variables automatically.
- **Customizable Fallback Chains**: Explicitly define a custom array of providers and model variations.
- **Zero SDK Dependencies**: Uses native HTTP agents (`fetch` in Node, `urllib` in Python) to keep package footprints small and free from version conflicts.
- **Standardized Response Structure**: Returns a unified JSON output indicating exactly which provider/model succeeded, the returned text, usage statistics, and any errors encountered during the fallback sequence.

---

## Repository Structure

```
├── packages/
│   ├── node/        # Node.js TypeScript library (npm: omnicall-llm)
│   └── python/      # Python package (pip: omnicall-llm)
├── examples/        # Language-specific demonstration scripts
└── README.md
```

---

## Getting Started

### Node.js / TypeScript

#### Installation
```bash
npm install omnicall-llm
```

#### Usage
```typescript
import { OmniCall, OmniEmbed } from 'omnicall-llm';

// 1. Text completion (with LLM fallback)
const client = new OmniCall();
const result = await client.generate("Write a haiku about recursion.");
console.log(result.text);

// 2. Embedding Generation (with auto-fallback)
const embedder = new OmniEmbed();
const embedResponse = await embedder.embed("Semantic search indexes are cool.");
console.log(embedResponse.embedding.slice(0, 5)); // returns vector array
```

---

### Python

#### Installation
```bash
pip install omnicall-llm
```

#### Usage
```python
from omnicall_llm import OmniCall, OmniEmbed

# 1. Text completion (with LLM fallback)
client = OmniCall()
result = client.generate("Write a haiku about recursion.")
print(result.text)

# 2. Embedding Generation (with auto-fallback)
embedder = OmniEmbed()
embed_response = embedder.embed("Semantic search indexes are cool.")
print(embed_response.embedding[:5]) # returns vector list
```

---

## Environment Variables & Default Models

`omnicall-llm` reads the following environment variables. Set any or all of them depending on which providers you want to make available:

| Provider | Environment Variable | Default Model | Base URL (OpenAI-compatible) |
| --- | --- | --- | --- |
| **Google Gemini** | `GEMINI_API_KEY` | `gemini-2.5-flash` | Direct Google REST API |
| **Groq** | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | `https://api.groq.com/openai/v1` |
| **SambaNova** | `SAMBANOVA_API_KEY` | `Meta-Llama-3.1-70B-Instruct` | `https://api.sambanova.ai/v1` |
| **Cerebras** | `CEREBRAS_API_KEY` | `llama-3.3-70b` | `https://api.cerebras.ai/v1` |
| **OpenRouter** | `OPENROUTER_API_KEY` | `meta-llama/llama-3.3-70b-instruct:free` | `https://openrouter.ai/api/v1` |
| **Mistral AI** | `MISTRAL_API_KEY` | `mistral-large-latest` | `https://api.mistral.ai/v1` |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4o-mini` | `https://api.openai.com/v1` |

---

## Combined Free Tier Capacity & Failover Resiliency

By pooling multiple free-tier inference APIs in a single fallback chain, `omnicall-llm` effectively constructs a **massive, highly resilient consolidated budget** of free LLM access. If one provider rate-limits you, the library transparently failovers to the next provider, meaning your daily request and token capacities are sum-totaled.

Here is a calculation of your **Combined Free capacity** when all keys are active:

| Provider | Free Daily Request Limit | Free Daily Token Limit | Key Feature / Benefit |
| --- | --- | --- | --- |
| **Google Gemini** | `1,500` requests / day | `1,500,000` tokens / day | Massively large context window (1M+ tokens) |
| **Groq** | `14,400` requests / day | ~5,000,000 tokens / day | Fast low-latency generation |
| **SambaNova** | ~`5,000` requests / day | ~10,000,000 tokens / day | Standard meta-llama-3 models |
| **Cerebras** | ~`10,000` requests / day | `1,000,000` tokens / day | Ultra-fast token execution speeds |
| **Mistral AI** | ~`1,000` requests / day | ~2,000,000 tokens / day | European frontier weights |
| **OpenRouter** | `50` requests / day | ~100,000 tokens / day | Free multi-model routing backup |
| **OpenAI** (Sandbox) | `200` requests / day | ~100,000 tokens / day | Standard fallback backup |
| **LUMPSUM TOTAL** | **32,150+ requests / day** | **23,700,000+ tokens / day** | **Highly Resilient & Redundant pooled limits** |

> [!TIP]
> **Total Pooled Capacity**: With all free API keys configured, `omnicall-llm` gives you a combined pool of over **32,000 daily requests** and **23+ Million daily tokens** completely free. This makes it perfect for running large background agent loops (like cold mail outreach scanners) without paying a single dollar in inference costs!

---

## Embedding Fallback Strategies & Dimension Warnings

When using `OmniEmbed`, the library automatically attempts to resolve embeddings across different providers. However, **vector dimension compatibility** is critical:

> [!WARNING]
> Different embedding models output vectors with different dimension sizes and distinct semantic vector spaces. 
> You **cannot** mix vectors from different models in a single vector search collection/index.

For this reason, we recommend the following strategies:

### 1. Identical-Model Failover (Recommended)
Fallback between different API hosting endpoints for the **exact same model weight**. This preserves vector dimension and semantic alignment.
- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Providers**: Hugging Face Inference API, custom Hugging Face endpoints/mirrors, or other hosters serving the identical weight.

### 2. Cross-Model Failover
If you fallback from a proprietary API (e.g. OpenAI) to another (e.g. Gemini), the vector dimensions and semantic spaces **will mismatch**. The returned `EmbeddingResponse` contains `dimensions` and `model` fields so that your application can detect when a fallback occurred and handle it (e.g., direct it to a separate search index or notify the client).

### Supported Embedding Models & Environment Keys

| Provider | Environment Variable | Default Model | Dimensions |
| --- | --- | --- | --- |
| **Hugging Face** | `HUGGINGFACE_API_KEY` | `sentence-transformers/all-MiniLM-L6-v2` | 384 |
| **OpenAI** | `OPENAI_API_KEY` | `text-embedding-3-small` | 1536 |
| **Google Gemini** | `GEMINI_API_KEY` | `text-embedding-004` | 768 |
| **Cohere** | `COHERE_API_KEY` | `embed-english-v3.0` | 1024 |
| **Jina AI** | `JINA_API_KEY` | `jina-embeddings-v2-base-en` | 768 |

---

## LangChain Integration

You can easily wrap `OmniCall` in a custom LangChain model class to use it within standard LangChain workflows:

### Node.js (LangChain.js)
```typescript
import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { OmniCall } from "omnicall-llm";

export class OmniCallChatModel extends SimpleChatModel {
  private client = new OmniCall();

  async _call(prompt: string): Promise<string> {
    const response = await this.client.generate(prompt);
    if (response.success) return response.text;
    throw new Error(`OmniCall failed: ${JSON.stringify(response.errors)}`);
  }

  _llmType(): string {
    return "omnicall";
  }
}
```

### Python (LangChain)
```python
from typing import Any, List, Optional
from langchain_core.language_models.llms import LLM
from omnicall_llm import OmniCall

class OmniCallLLM(LLM):
    client: Any = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.client = OmniCall()

    def _call(self, prompt: str, **kwargs: Any) -> str:
        response = self.client.generate(prompt, **kwargs)
        if response.success:
            return response.text
        raise RuntimeError(f"OmniCall failed. Errors: {response.errors}")

    @property
    def _llm_type(self) -> str:
        return "omnicall"
```

---

## License

MIT License.
