import os
import sys

# Add packages/python/src to sys.path so we can import omnicall_llm directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../packages/python/src')))

from omnicall_llm import OmniCall

def main():
    print('--- OmniCall Python Example ---')
    
    # Initialize the client. It automatically picks up keys from os.environ
    client = OmniCall()

    print('Sending request to LLM (with auto-fallback)...')
    response = client.generate('Explain API fallbacks in 1 sentence.')
    
    print(f"\nResult success: {response.success}")
    print(f"Provider that responded: {response.provider}")
    print(f"Model that responded: {response.model}")
    print(f"Output text: {response.text}")
    
    if response.usage:
        print(f"Usage metrics: {response.usage}")
        
    if response.errors:
        print("\nErrors encountered during fallback chain:")
        for idx, err in enumerate(response.errors):
            print(f"[{idx + 1}] Provider: {err['provider']}, Model: {err['model']}, Error: {err['error']}")

if __name__ == '__main__':
    main()
