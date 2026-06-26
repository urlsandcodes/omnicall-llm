const { OmniEmbed } = require('../packages/node/dist/cjs/index.js');

async function main() {
  console.log('--- OmniEmbed Node.js Example ---');
  
  // Initialize OmniEmbed. It will automatically check process.env for HUGGINGFACE_API_KEY, OPENAI_API_KEY, etc.
  const embedder = new OmniEmbed();

  console.log('Generating embedding vector (with auto-fallback)...');
  const response = await embedder.embed('Semantic search indexes are cool.');
  
  console.log('\nResult success:', response.success);
  console.log('Provider that responded:', response.provider);
  console.log('Model that responded:', response.model);
  console.log('Vector dimension:', response.dimensions);
  console.log('First 5 elements of vector:', response.embedding.slice(0, 5));
  
  if (response.errors && response.errors.length > 0) {
    console.log('\nErrors encountered during fallback chain:');
    response.errors.forEach((err, index) => {
      console.log(`[${index + 1}] Provider: ${err.provider}, Model: ${err.model}, Error: ${err.error}`);
    });
  }
}

main().catch(console.error);
