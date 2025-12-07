# Bedrock Anthropic Proxy (TypeScript + Hono)

TypeScript + Hono 版本的 AWS Lambda 代理，将 Anthropic Messages API 转发到 AWS Bedrock Claude，支持流式与非流式响应。

## 功能特性

- ✅ TypeScript + Hono 路由（基于 `@hono/aws-lambda`）
- ✅ 支持非流式响应
- ✅ 支持流式响应（SSE，Function URL `RESPONSE_STREAM`）
- ✅ Bearer Token 认证
- ✅ CORS 支持
- ✅ 兼容 Anthropic Messages API 请求格式

## 前置要求

- AWS 账号并已开通 Bedrock
- AWS CLI、AWS SAM CLI
- Node.js 20.x+
- 环境变量 `BEARER_TOKEN`

## 本地构建

```bash
npm install
npm run build  # 生成 dist/handler.js
```

## 部署

```bash
sam build
sam deploy --guided
```

交互提示：
- Stack Name: `bedrock-anthropic-proxy`
- AWS Region: 选择支持 Bedrock 的区域
- Parameter BearerToken: 输入 Bearer Token

部署完成后，SAM 输出 `FunctionUrl`，支持流式与非流式请求。

## 调用示例

### 非流式

```bash
curl -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [{"role": "user", "content": "Hello, Claude!"}],
    "max_tokens": 1000
  }'
```

### 流式（SSE）

```bash
curl -N -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "max_tokens": 1000,
    "stream": true
  }'
```

## 环境变量

- `BEARER_TOKEN`：认证用 Bearer Token（必需）
- `AWS_REGION`：默认 `us-east-1`

## 目录结构

```
bedrock-anthropic-proxy-1/
├── src/
│   ├── app.ts         # Hono 应用，认证/CORS/路由/流式处理
│   └── handler.ts     # AWS Lambda 入口（streamHandle）
├── template.yaml      # SAM 模板（Function URL，RESPONSE_STREAM）
├── package.json
├── tsconfig.json
└── README.md
```

## 其他说明

- 需在部署前执行 `npm run build` 生成 `dist/handler.js`。
- 流式响应通过 SSE 输出，非流式返回 JSON。
- 如需调整模型权限，请修改 `template.yaml` 中的 `Policies`。
