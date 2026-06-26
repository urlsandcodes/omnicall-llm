const { OmniCall } = require('../packages/node/dist/cjs/index.js');

async function main() {
  console.log('--- OmniCall Node.js Example ---');
  
  // Set up OmniCall. It will automatically check process.env for GEMINI_API_KEY, GROQ_API_KEY, etc.
  const client = new OmniCall();

  console.log('Sending request to LLM (with auto-fallback)...');
  const response = await client.generate('Explain API fallbacks in 1 sentence.');
  
  console.log('\nResult success:', response.success);
  console.log('Provider that responded:', response.provider);
  console.log('Model that responded:', response.model);
  console.log('Output text:', response.text);
  
  if (response.usage) {
    console.log('Usage metrics:', response.usage);
  }
  
  if (response.errors && response.errors.length > 0) {
    console.log('\nErrors encountered during fallback chain:');
    response.errors.forEach((err, index) => {
      console.log(`[${index + 1}] Provider: ${err.provider}, Model: ${err.model}, Error: ${err.error}`);
    });
  }
}

main().catch(console.error);
