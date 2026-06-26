import os
from typing import Dict, Any, List, Optional

from .providers import PROVIDERS, call_provider_api

DEFAULT_PRIORITY = [
    'gemini',
    'groq',
    'sambanova',
    'cerebras',
    'openrouter',
    'mistral',
    'openai',
]

class OmniCallResponse:
    def __init__(
        self,
        success: bool,
        provider: str,
        model: str,
        text: str,
        usage: Optional[Dict[str, int]] = None,
        errors: Optional[List[Dict[str, str]]] = None
    ):
        self.success = success
        self.provider = provider
        self.model = model
        self.text = text
        self.usage = usage
        self.errors = errors if errors is not None else []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "provider": self.provider,
            "model": self.model,
            "text": self.text,
            "usage": self.usage,
            "errors": self.errors
        }

    def __repr__(self) -> str:
        return f"OmniCallResponse(success={self.success}, provider='{self.provider}', model='{self.model}', text_length={len(self.text)})"

class OmniCall:
    def __init__(
        self,
        api_keys: Optional[Dict[str, str]] = None,
        default_fallback_order: Optional[List[str]] = None
    ):
        self.api_keys = {}
        self.default_fallback_order = default_fallback_order or DEFAULT_PRIORITY

        for provider in DEFAULT_PRIORITY:
            config = PROVIDERS[provider]
            env_key = config['env_key']
            
            # Read from constructor args first, then environment
            self.api_keys[provider] = (
                (api_keys.get(provider) if api_keys else None)
                or os.environ.get(env_key)
            )

    def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        api_key: Optional[str] = None,
        fallback: Optional[List[Dict[str, str]]] = None
    ) -> OmniCallResponse:
        errors = []
        queue = []

        if fallback:
            # User provided a custom fallback sequence
            for item in fallback:
                p_name = item.get("provider")
                if p_name:
                    queue.append({
                        "provider": p_name,
                        "model": item.get("model") or PROVIDERS[p_name]["default_model"]
                    })
        else:
            # Build fallback queue dynamically
            if provider:
                queue.append({
                    "provider": provider,
                    "model": model or PROVIDERS[provider]["default_model"]
                })

            # Append other available providers in priority order
            available_providers = [
                p for p in self.default_fallback_order
                if p != provider and self.api_keys.get(p)
            ]

            for p in available_providers:
                queue.append({
                    "provider": p,
                    "model": PROVIDERS[p]["default_model"]
                })

        # If queue is empty, fallback to default order hoping a key is passed in options
        if not queue:
            if provider:
                queue.append({
                    "provider": provider,
                    "model": model or PROVIDERS[provider]["default_model"]
                })
            else:
                for p in self.default_fallback_order:
                    queue.append({
                        "provider": p,
                        "model": PROVIDERS[p]["default_model"]
                    })

        # Iterate and call in sequence
        for attempt in queue:
            p_name = attempt["provider"]
            m_name = attempt["model"]

            # Resolve API Key
            resolved_key = (
                api_key if p_name == provider else None
            ) or self.api_keys.get(p_name)

            if not resolved_key:
                errors.append({
                    "provider": p_name,
                    "model": m_name,
                    "error": f"Missing API key for provider {p_name}. Check your env ({PROVIDERS[p_name]['env_key']}) or constructor configuration."
                })
                continue

            try:
                result = call_provider_api(
                    provider=p_name,
                    model=m_name,
                    prompt=prompt,
                    api_key=resolved_key,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                return OmniCallResponse(
                    success=True,
                    provider=p_name,
                    model=m_name,
                    text=result["text"],
                    usage=result.get("usage"),
                    errors=errors
                )
            except Exception as e:
                errors.append({
                    "provider": p_name,
                    "model": m_name,
                    "error": str(e)
                })

        # If all failed
        default_provider = queue[0]["provider"] if queue else "gemini"
        default_model = queue[0]["model"] if queue else PROVIDERS["gemini"]["default_model"]
        return OmniCallResponse(
            success=False,
            provider=default_provider,
            model=default_model,
            text="",
            errors=errors
        )
