# Bedrock Anthropic Proxy (Bun + TypeScript + Hono)

独立 HTTP 服务器版本（非 Lambda），使用 Bun + TypeScript + Hono，将 Anthropic Messages API 请求转发到 AWS Bedrock Claude，支持流式与非流式响应。

## 功能

- ✅ Bun 原生运行（`Bun.serve`）
- ✅ TypeScript + Hono 路由
- ✅ Bearer Token 认证
- ✅ CORS 支持
- ✅ 非流式 / 流式（SSE）响应
- ✅ 兼容 Anthropic Messages API 格式

## 前置要求

- Bun ≥ 1.1
- Node/Bun 环境可访问 AWS Bedrock（需 AWS 凭证：如 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` 等）
- 环境变量：
  - `BEARER_TOKEN`（必需）
  - `AWS_REGION`（可选，默认 `us-east-1`）
  - `PORT`（可选，默认 `3000`）

## 启动

```bash
cd bedrock-anthropic-proxy-2
bun install
bun run dev   # 热更新
# 或
bun run start # 生产/常规运行
```

启动后默认监听 `http://localhost:3000`。

## 调用示例

### 非流式

```bash
curl -X POST http://localhost:3000/ \
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
curl -N -X POST http://localhost:3000/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "max_tokens": 1000,
    "stream": true
  }'
```

响应会使用 SSE 输出 `event: <chunk.type>` 和对应的 `data`。

## 目录结构

```
bedrock-anthropic-proxy-2/
├── src/
│   ├── app.ts     # Hono 应用，认证/CORS/路由/流式处理
│   └── server.ts  # Bun 入口（Bun.serve）
├── package.json
├── tsconfig.json
└── README.md
```

## 备注

- `BEARER_TOKEN` 未设置时会直接拒绝请求。
- CORS 默认允许所有来源（可在 `src/app.ts` 中调整）。
- 流式响应通过 SSE 推送，非流式返回 JSON。需要确保调用方支持 SSE。
