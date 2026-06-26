import os
import sys

# Add packages/python/src to sys.path so we can import omnicall_llm directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../packages/python/src')))

from omnicall_llm import OmniEmbed

def main():
    print('--- OmniEmbed Python Example ---')
    
    # Initialize OmniEmbed. It will automatically check os.environ for HUGGINGFACE_API_KEY, OPENAI_API_KEY, etc.
    embedder = OmniEmbed()

    print('Generating embedding vector (with auto-fallback)...')
    response = embedder.embed('Semantic search indexes are cool.')
    
    print(f"\nResult success: {response.success}")
    print(f"Provider that responded: {response.provider}")
    print(f"Model that responded: {response.model}")
    print(f"Vector dimension: {response.dimensions}")
    print(f"First 5 elements of vector: {response.embedding[:5]}")
    
    if response.errors:
        print("\nErrors encountered during fallback chain:")
        for idx, err in enumerate(response.errors):
            print(f"[{idx + 1}] Provider: {err['provider']}, Model: {err['model']}, Error: {err['error']}")

if __name__ == '__main__':
    main()
