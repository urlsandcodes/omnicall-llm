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
import { OmniCall } from 'omnicall-llm';

// Reads process.env.GEMINI_API_KEY, process.env.GROQ_API_KEY, etc.
const client = new OmniCall();

const result = await client.generate("Write a haiku about recursion.");

console.log(result.text);
console.log(`Responded by: ${result.provider} (${result.model})`);
```

---

### Python

#### Installation
```bash
pip install omnicall-llm
```

#### Usage
```python
from omnicall_llm import OmniCall

# Reads os.environ["GEMINI_API_KEY"], os.environ["GROQ_API_KEY"], etc.
client = OmniCall()

result = client.generate("Write a haiku about recursion.")

print(result.text)
print(f"Responded by: {result.provider} ({result.model})")
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
