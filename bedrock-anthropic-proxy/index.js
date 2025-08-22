import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

const client = new AnthropicBedrock({
  awsRegion: process.env.AWS_REGION || 'us-east-1',
});

const validateBearerToken = (headers) => {
  const authHeader = headers.authorization || headers.Authorization;
  const bearer = 'Bearer ';
  if (!authHeader || !authHeader.startsWith(bearer)) {
    return false;
  }

  const token = authHeader.substring(bearer.length);
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    console.error('BEARER_TOKEN environment variable not set');
    return false;
  }

  return token === expectedToken;
};

const parseRequestBody = (body, isBase64Encoded) => {
  let parsedBody;
  if (isBase64Encoded) {
    const decodedBody = Buffer.from(body, 'base64').toString('utf-8');
    parsedBody = JSON.parse(decodedBody);
  } else {
    parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  }
  return parsedBody;
};

const sendResponse = (responseStream, statusCode, headers, body) => {
  responseStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: {
      ...headers,
      'Access-Control-Allow-Origin': '*',
    }
  });
  responseStream.write(typeof body === 'string' ? body : JSON.stringify(body));
  responseStream.end();
};

const sendErrorResponse = (responseStream, statusCode, message, type) => {
  sendResponse(responseStream, statusCode, { 'Content-Type': 'application/json' }, {
    error: {
      message,
      type: type || 'api_error',
    }
  });
};

const createBedrockRequest = (requestBody) => {
  if (true) {
    return requestBody;
  }
  return {
    model: requestBody.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    max_tokens: requestBody.max_tokens || 4096,
    messages: requestBody.messages,
    system: requestBody.system,
    temperature: requestBody.temperature,
    top_p: requestBody.top_p,
    top_k: requestBody.top_k,
    stop_sequences: requestBody.stop_sequences,
    metadata: requestBody.metadata,
    stream: requestBody.stream === true,
  };
};

export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    // Handle OPTIONS request
    if (event.requestContext?.http?.method === 'OPTIONS') {
      sendResponse(responseStream, 200, {
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }, '');
      return;
    }

    // Validate Bearer token
    if (!validateBearerToken(event.headers)) {
      sendErrorResponse(responseStream, 401, 'Unauthorized', 'authentication_error');
      return;
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = parseRequestBody(event.body, event.isBase64Encoded);
    } catch (error) {
      console.error('Error parsing request body:', error);
      sendErrorResponse(responseStream, 400, 'Invalid request body', 'invalid_request_error');
      return;
    }

    // Create Bedrock request
    const bedrockRequest = createBedrockRequest(requestBody);

    try {
      if (bedrockRequest.stream) {
        // Handle streaming response
        responseStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          }
        });

        const bedrockStream = await client.messages.create(bedrockRequest);
        for await (const chunk of bedrockStream) {
          responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        responseStream.write('data: [DONE]\n\n');
        responseStream.end();
      } else {
        // Handle non-streaming response
        const response = await client.messages.create(bedrockRequest);
        sendResponse(responseStream, 200, { 'Content-Type': 'application/json' }, response);
      }
    } catch (error) {
      console.error('Error calling Bedrock:', error);

      // Check if we're in streaming mode and headers were already sent
      if (bedrockRequest.stream && responseStream.headersSent) {
        responseStream.write(`data: ${JSON.stringify({
          error: {
            message: error.message || 'Internal server error',
            type: error.error?.type || 'api_error',
          }
        })}\n\n`);
        responseStream.end();
      } else {
        sendErrorResponse(
          responseStream,
          error.status || 500,
          error.message || 'Internal server error',
          error.error?.type || 'api_error'
        );
      }
    }
  }
);
