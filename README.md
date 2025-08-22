# Anthropic Proxy

A high-performance AWS Lambda proxy that bridges Anthropic's Messages API to AWS Bedrock Claude models, providing seamless integration with enterprise-grade security and scalability.

## Features

- **Full API Compatibility**: Complete implementation of Anthropic Messages API
- **Streaming Support**: Native Server-Sent Events (SSE) for real-time responses
- **Enterprise Security**: Bearer token authentication with AWS IAM integration
- **Auto-scaling**: Leverages AWS Lambda's automatic scaling capabilities
- **Multi-model Support**: Access all Claude models available in AWS Bedrock
- **CORS Ready**: Built-in CORS support for web applications

## Project Structure

```
anthropic-proxy/
├── bedrock-anthropic-proxy/    # Lambda function implementation
│   ├── index.js                # Main handler with streaming support
│   ├── template.yaml            # AWS SAM deployment template
│   └── package.json             # Node.js dependencies
└── notebook/                    # Testing and validation tools
    ├── messages.ipynb           # API testing notebook
    └── pyproject.toml           # Python dependencies (uv)
```

## Quick Start

### Prerequisites

- AWS Account with Bedrock access enabled
- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Node.js 20.x or higher
- Bearer token for API authentication

### Deployment

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/anthropic-proxy.git
   cd anthropic-proxy/bedrock-anthropic-proxy
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the Lambda function**

   ```bash
   sam build
   ```

4. **Deploy to AWS**

   ```bash
   sam deploy --guided
   ```

   During the guided deployment:
   - Stack Name: `bedrock-anthropic-proxy`
   - AWS Region: Choose a region with Bedrock support
   - Parameter BearerToken: Enter your secure bearer token
   - Accept other defaults

5. **Get your endpoint URL**

   After deployment, SAM will output the Function URL. Save this for API calls.

## Usage

### Basic Request (Non-streaming)

```bash
curl -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ],
    "max_tokens": 1000
  }'
```

### Streaming Request

```bash
curl -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [
      {"role": "user", "content": "Write a story"}
    ],
    "max_tokens": 1000,
    "stream": true
  }'
```

### Python Client Example

```python
from anthropic import Anthropic

client = Anthropic(
    auth_token="YOUR_BEARER_TOKEN",
    base_url="https://your-function-url.lambda-url.region.on.aws"
)

# Non-streaming
response = client.messages.create(
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1000
)

# Streaming
with client.messages.stream(
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1000
) as stream:
    for chunk in stream.text_stream:
        print(chunk, end="", flush=True)
```

## Supported Models

| Model | Model ID |
|-------|----------|
| Claude 3.5 Sonnet (Latest) | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Claude 3.5 Haiku | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| Claude 3 Opus | `anthropic.claude-3-opus-20240229-v1:0` |
| Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0` |
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` |

## API Features

### Supported Parameters

- ✅ `messages` - Conversation history
- ✅ `model` - Model selection
- ✅ `max_tokens` - Maximum response length
- ✅ `system` - System prompts
- ✅ `temperature` - Response randomness (0-1)
- ✅ `top_p` - Nucleus sampling
- ✅ `top_k` - Top-K sampling
- ✅ `stop_sequences` - Custom stop sequences
- ✅ `metadata` - Request metadata
- ✅ `stream` - Enable streaming responses

### Response Formats

#### Non-streaming Response

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Response text here"
    }
  ],
  "model": "claude-3-5-sonnet",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

#### Streaming Response (SSE)

```text
event: message_start
data: {"type": "message_start", ...}

event: content_block_delta
data: {"type": "content_block_delta", "delta": {"text": "Hello"}}

event: message_stop
data: {"type": "message_stop"}
```

## Testing

### Using the Notebook

1. **Set up Python environment**

   ```bash
   cd notebook
   uv install
   ```

2. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```bash
   ANTHROPIC_AUTH_TOKEN=your-bearer-token
   ANTHROPIC_BASE_URL=https://your-function-url.lambda-url.region.on.aws
   ```

3. **Run the test notebook**

   ```bash
   jupyter notebook messages.ipynb
   ```

### Local Testing with SAM

```bash
sam local start-lambda
```

## Architecture

The proxy uses a single Lambda function with intelligent routing:

- **Unified Handler**: Single entry point (`index.handler`) for all requests
- **Auto-routing**: Automatically switches between streaming/non-streaming based on request
- **Native Streaming**: Uses Lambda's `awslambda.streamifyResponse()` for efficient SSE
- **Stateless Design**: No persistent connections, scales automatically
- **Regional Deployment**: Deploy close to your users for minimal latency

## Security Considerations

- **Authentication**: Bearer token validation on every request
- **AWS IAM**: Lambda execution role with minimal Bedrock permissions
- **No Data Storage**: Stateless design, no request/response logging
- **CORS Configuration**: Customizable origin restrictions
- **Token Management**: Use AWS Secrets Manager for production deployments

## Performance

- **Cold Start**: ~1-2 seconds (mitigated by Lambda SnapStart)
- **Warm Response**: <100ms latency overhead
- **Streaming**: First token latency matches Bedrock's native performance
- **Concurrency**: Automatic scaling up to AWS Lambda limits
- **Memory**: 1024MB default (configurable in `template.yaml`)

## Troubleshooting

### 401 Unauthorized

- Verify Bearer token matches environment variable
- Check `BEARER_TOKEN` in Lambda configuration

### 500 Internal Server Error

- Check CloudWatch logs for detailed errors
- Verify Lambda has Bedrock permissions
- Ensure model is available in your region

### Streaming Not Working

- Confirm `"stream": true` in request body
- Verify client supports Server-Sent Events
- Check Function URL uses `RESPONSE_STREAM` mode

### Model Not Found

- Verify model ID is correct
- Check model is enabled in Bedrock console
- Ensure region supports the requested model

## Cost Optimization

- **Lambda Pricing**: Pay per invocation and duration
- **Bedrock Pricing**: Standard Bedrock rates apply
- **Data Transfer**: Minimize by deploying in same region as clients
- **Reserved Concurrency**: Set limits to control costs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check AWS Bedrock documentation
- Review Anthropic API documentation

## How to use with Claude Code

1. `export ANTHROPIC_BASE_URL=<AWS Lambda function URL>`
2. `export ANTHROPIC_AUTH_TOKEN=<AWS Lambda environment variable BEARER_TOKEN>`
