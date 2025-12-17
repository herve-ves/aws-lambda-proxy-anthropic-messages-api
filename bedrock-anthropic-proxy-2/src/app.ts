import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import type { RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages/messages';
import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { stream } from 'hono/streaming';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

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

const app = new Hono<{ Variables: { requestId: string } }>();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && level in LOG_LEVELS) {
    return level as LogLevel;
  }
  return 'info';
};

const log = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
  const minLevel = getLogLevel();
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) {
    return;
  }

  const output = { level, msg, ...meta };
  if (level === 'error') {
    console.error(JSON.stringify(output));
  } else {
    console.log(JSON.stringify(output));
  }
};

const isAsyncIterable = <T>(value: unknown): value is AsyncIterable<T> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === 'function';

const isContentfulStatusCode = (status: unknown): status is ContentfulStatusCode =>
  typeof status === 'number' &&
  status >= 100 &&
  status <= 599 &&
  status !== 101 &&
  status !== 204 &&
  status !== 205 &&
  status !== 304;

const toContentfulStatusCode = (status: unknown): ContentfulStatusCode =>
  isContentfulStatusCode(status) ? status : 500;

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);

  if (c.req.method === 'OPTIONS') {
    log('debug', 'options preflight', { requestId, path: c.req.path });
    return next();
  }

  const expectedToken = process.env.BEARER_TOKEN;
  if (!expectedToken) {
    log('error', 'missing bearer token env');
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  const authHeader = c.req.header('authorization') || c.req.header('Authorization');
  const bearerPrefix = 'Bearer ';

  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    log('warn', 'authorization header missing/invalid', { requestPath: c.req.path });
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  const token = authHeader.slice(bearerPrefix.length);
  if (token !== expectedToken) {
    log('warn', 'bearer token mismatch', { requestId });
    return c.json({ error: { message: 'Unauthorized', type: 'authentication_error' } }, 401);
  }

  await next();
});

app.options('*', (c) => c.body(null, 204));

const buildError = (error: unknown): { status: ContentfulStatusCode; payload: { error: ErrorShape } } => {
  const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
  const status = toContentfulStatusCode(err?.status);
  const type = err?.error?.type || 'api_error';
  const message = err?.error?.message || err?.message || 'Internal server error';

  return {
    status,
    payload: {
      error: { message, type },
    },
  };
};

app.post('/v1/messages', async (c) => {
  let requestBody: MessageParams;
  const requestId = c.get('requestId');

  try {
    requestBody = await c.req.json<MessageParams>();
  } catch (error) {
    log('error', 'invalid request body', { requestId, error: (error as Error)?.message });
    return c.json({ error: { message: 'Invalid request body', type: 'invalid_request_error' } }, 400);
  }

  const wantsStream = requestBody.stream === true;
  log('info', 'request.received', {
    requestId,
    stream: wantsStream,
    model: (requestBody as { model?: string }).model,
    messagesCount: Array.isArray((requestBody as { messages?: unknown[] }).messages)
      ? (requestBody as { messages?: unknown[] }).messages?.length
      : undefined,
  });

  if (wantsStream) {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(
      c,
      async (streamWriter) => {
        try {
          log('debug', 'stream.start', { requestId });
          const bedrockStream = await client.messages.create({ ...requestBody, stream: true });
          if (!isAsyncIterable<RawMessageStreamEvent>(bedrockStream)) {
            throw new Error('Expected streaming response from Bedrock');
          }

          for await (const chunk of bedrockStream) {
            await streamWriter.write(`event: ${chunk.type}\n`);
            await streamWriter.write(`data: ${JSON.stringify(chunk)}\n\n`);
            log('debug', 'stream.chunk', { requestId, type: (chunk as { type?: string }).type });
          }
        } catch (error) {
          const { payload } = buildError(error);
          await streamWriter.write(`event: error\n`);
          await streamWriter.write(`data: ${JSON.stringify({ type: 'error', ...payload })}\n\n`);
          log('error', 'stream.error', { requestId, error: (error as Error)?.message });
        } finally {
          await streamWriter.close();
          log('info', 'stream.end', { requestId });
        }
      }
    );
  }

  try {
    const response = await client.messages.create(requestBody);
    log('info', 'request.success', { requestId });
    return c.json(response);
  } catch (error) {
    const { status, payload } = buildError(error);
    log('error', 'request.error', { requestId, status, error: payload.error.message });
    return c.json(payload, status);
  }
});

app.notFound((c) => c.json({ error: { message: 'Not Found', type: 'invalid_request_error' } }, 404));

export { app };
