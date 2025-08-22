# Bedrock Anthropic Proxy

AWS Lambda函数，用于将Anthropic Messages API代理到AWS Bedrock的Claude模型。

## 功能特性

- ✅ 支持非流式响应
- ✅ 支持流式响应（SSE，使用Lambda原生的`awslambda.streamifyResponse()`）
- ✅ Bearer Token认证
- ✅ CORS支持
- ✅ 兼容Anthropic Messages API格式
- ✅ AWS SAM部署模板

## 前置要求

- AWS账户，并启用Bedrock服务
- AWS CLI配置完成
- AWS SAM CLI
- Node.js 20.x或更高版本
- 在AWS Bedrock中有权访问Claude模型

## 安装依赖

```bash
npm install
```

## 部署

### 1. 构建Lambda函数

```bash
sam build
```

### 2. 部署到AWS

首次部署：
```bash
sam deploy --guided
```

在交互式提示中：
- Stack Name: 输入堆栈名称（如 `bedrock-anthropic-proxy`）
- AWS Region: 选择部署区域（确保该区域支持Bedrock）
- Parameter BearerToken: 输入用于API认证的Bearer Token
- 其他选项可以使用默认值

后续部署：
```bash
sam deploy
```

### 3. 获取Function URL

部署完成后，SAM会输出Function URL：
- `FunctionUrl`: 支持流式和非流式请求（根据request body中的`stream`参数自动切换）

## 使用方法

### 非流式请求

```bash
curl -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [
      {
        "role": "user",
        "content": "Hello, Claude!"
      }
    ],
    "max_tokens": 1000
  }'
```

### 流式请求

```bash
curl -X POST https://your-function-url.lambda-url.region.on.aws/ \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "messages": [
      {
        "role": "user",
        "content": "Hello, Claude!"
      }
    ],
    "max_tokens": 1000,
    "stream": true
  }'
```

## 支持的模型

- `anthropic.claude-3-5-sonnet-20241022-v2:0`
- `anthropic.claude-3-5-haiku-20241022-v1:0`
- `anthropic.claude-3-opus-20240229-v1:0`
- `anthropic.claude-3-sonnet-20240229-v1:0`
- `anthropic.claude-3-haiku-20240307-v1:0`

## API兼容性

该Lambda函数实现了Anthropic Messages API的核心功能：

- ✅ `messages` - 消息历史
- ✅ `model` - 模型选择
- ✅ `max_tokens` - 最大输出令牌数
- ✅ `system` - 系统提示
- ✅ `temperature` - 温度参数
- ✅ `top_p` - Top-P采样
- ✅ `top_k` - Top-K采样
- ✅ `stop_sequences` - 停止序列
- ✅ `metadata` - 元数据
- ✅ `stream` - 流式响应

## 环境变量

- `BEARER_TOKEN`: API认证的Bearer Token（必需）
- `AWS_REGION`: AWS区域（默认: us-east-1）

## 本地测试

创建 `.env` 文件：
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际的配置
```

使用SAM本地测试：
```bash
sam local start-lambda
```

## 技术特点

- **单一入口点**: 使用单个Lambda handler处理所有请求
- **自动路由**: 根据request body中的`stream`参数自动选择流式或非流式处理
- **原生流式支持**: 使用Lambda运行时自带的`awslambda.streamifyResponse()`
- **统一配置**: Function URL配置为`RESPONSE_STREAM`模式，兼容两种响应类型

## 注意事项

1. **成本**: 使用AWS Bedrock会产生费用，请参考AWS Bedrock定价
2. **限流**: AWS Bedrock有API调用限制，请根据实际需求配置
3. **安全**: 
   - Bearer Token应妥善保管，定期轮换
   - 建议在生产环境中使用AWS Secrets Manager管理敏感信息
   - 可以根据需要配置更严格的CORS策略
4. **超时**: Lambda函数默认超时时间为300秒，可在`template.yaml`中调整

## 故障排除

### 401 Unauthorized
- 检查Bearer Token是否正确
- 确认环境变量`BEARER_TOKEN`已正确设置

### 500 Internal Server Error
- 检查CloudWatch日志了解详细错误信息
- 确认Lambda函数有权限访问Bedrock服务
- 验证所选模型在当前区域是否可用

### 流式响应不工作
- 确保request body中包含`"stream": true`
- 验证客户端支持Server-Sent Events (SSE)
- 检查Function URL配置是否为`RESPONSE_STREAM`模式

## License

MIT
