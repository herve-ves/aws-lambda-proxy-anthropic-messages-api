import { app } from './app.js';

const port = Number(process.env.PORT || 3000);

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Bedrock Anthropic Proxy running on http://localhost:${port}`);

export type Server = typeof server;
