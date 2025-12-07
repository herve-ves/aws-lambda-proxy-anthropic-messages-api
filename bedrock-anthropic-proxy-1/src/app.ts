import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { stream } from 'hono/streaming';

type ErrorShape = {
  message: string;
  type: string;
};
type MessageParams = Parameters<InstanceType<typeof AnthropicBedrock>['messages']['create']>[0] & {
  stream?: boolean;
};

const client = new AnthropicBedrock({
  awsRegion: process.env.AWS_REGION || 'us-east-1',
});

const app = new Hono();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next();
  }

  const expectedToken = process.env.BEARER_TOKEN;
  if (!expectedToken) {
    console.error('BEARER_TOKEN environment variable not set');
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  const authHeader = c.req.header('authorization') || c.req.header('Authorization');
  const bearerPrefix = 'Bearer ';

  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  const token = authHeader.slice(bearerPrefix.length);
  if (token !== expectedToken) {
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  await next();
});

app.options('*', (c) => c.text('', 204));

const buildError = (error: unknown): { status: number; payload: { error: ErrorShape } } => {
  const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
  const status = err?.status && typeof err.status === 'number' ? err.status : 500;
  const type = err?.error?.type || 'api_error';
  const message = err?.error?.message || err?.message || 'Internal server error';

  return {
    status,
    payload: {
      error: { message, type },
    },
  };
};

app.post('/', async (c) => {
  let requestBody: MessageParams;

  try {
    requestBody = await c.req.json<MessageParams>();
  } catch (error) {
    console.error('Error parsing request body:', error);
    return c.json({ error: { message: 'Invalid request body', type: 'invalid_request_error' } }, 400);
  }

  const wantsStream = Boolean(requestBody.stream);

  if (wantsStream) {
    return stream(
      c,
      async (streamWriter) => {
        try {
          const bedrockStream = await client.messages.create(requestBody);
          for await (const chunk of bedrockStream) {
            await streamWriter.write(`event: ${chunk.type}\n`);
            await streamWriter.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } catch (error) {
          const { payload } = buildError(error);
          await streamWriter.write(`event: error\n`);
          await streamWriter.write(`data: ${JSON.stringify({ type: 'error', ...payload })}\n\n`);
        } finally {
          await streamWriter.close();
        }
      },
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    const response = await client.messages.create(requestBody);
    return c.json(response);
  } catch (error) {
    const { status, payload } = buildError(error);
    return c.json(payload, status);
  }
});

app.notFound((c) => c.json({ error: { message: 'Not Found', type: 'invalid_request_error' } }, 404));

export { app };
