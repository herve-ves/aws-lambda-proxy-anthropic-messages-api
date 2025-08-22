# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This repository implements an AWS Lambda-based proxy that translates Anthropic Messages API requests to AWS Bedrock Claude models. The project consists of two main components:

1. **bedrock-anthropic-proxy/**: AWS Lambda function that serves as the API proxy
   - Handles both streaming (SSE) and non-streaming responses
   - Uses AWS SAM for deployment
   - Implements Bearer token authentication
   - Automatically routes requests based on `stream` parameter in request body

2. **notebook/**: Python test environment for validating the proxy
   - Uses `uv` for dependency management
   - Contains Jupyter notebooks for testing various API scenarios

## Key Technical Details

- **Lambda Runtime**: Node.js 20.x with ES modules (`type: "module"`)
- **Streaming Implementation**: Uses Lambda's native `awslambda.streamifyResponse()` for SSE support
- **Response Format**: Maintains Anthropic API compatibility (not OpenAI format - no `data: [DONE]` needed)
- **Authentication**: Bearer token validation via environment variable

## Common Commands

### Lambda Function (bedrock-anthropic-proxy/)

```bash
# Install dependencies
npm install

# Build for deployment
sam build

# Deploy (first time - interactive)
sam deploy --guided

# Deploy (subsequent)
sam deploy

# Local testing
sam local start-lambda

# Package manually for upload
./pack-it.sh
```

### Python Testing Environment (notebook/)

```bash
# Install dependencies (using uv)
uv install

# Run Jupyter notebook
jupyter notebook
```

## Environment Configuration

Create `.env` files based on examples:

- `bedrock-anthropic-proxy/.env`: Set `BEARER_TOKEN` and `AWS_REGION`
- Root `.env`: Set `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` for testing

## Supported Models

All AWS Bedrock Claude models:
- `anthropic.claude-3-5-sonnet-20241022-v2:0`
- `anthropic.claude-3-5-haiku-20241022-v1:0`
- `anthropic.claude-3-opus-20240229-v1:0`
- `anthropic.claude-3-sonnet-20240229-v1:0`
- `anthropic.claude-3-haiku-20240307-v1:0`

## API Response Formats

### Streaming (SSE)
```
event: message_start
data: {"type": "message_start", ...}

event: content_block_delta
data: {"type": "content_block_delta", ...}

event: message_stop
data: {"type": "message_stop"}
```

### Non-streaming
Standard Anthropic Messages API JSON response.

## Error Handling

The proxy returns Anthropic-compatible error responses:
```json
{
  "error": {
    "message": "Error description",
    "type": "error_type"
  }
}
```
- Write codes, comments and documents in English officially