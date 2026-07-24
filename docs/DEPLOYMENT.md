# 生产部署与回滚

DevFlow 需要 Node.js 服务器、MongoDB 事务、Auth.js 和 Route Handlers，不能当作纯静态站点部署。

## 1. 上线前条件

- Node.js 22+、pnpm 11，并使用 `pnpm-lock.yaml` 锁定依赖。
- MongoDB Atlas 或开启 replica set 的 MongoDB，因为采纳、通知和计数使用事务。
- 一个长随机 `AUTH_SECRET`，它同时保护认证数据和 Feed Cursor 签名。
- 预览环境和生产环境使用不同的数据库、OAuth 回调和密钥。

## 2. 发布前门禁

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm check:week4
pnpm check:week56
pnpm check:week7
pnpm build
pnpm test:e2e
pnpm test:lighthouse
```

`pnpm build` 是当前仓库验证过的 webpack 生产路径。预览环境应再完成一次真实数据库的登录、发布问题、回答和推荐翻页验收。

## 3. 生产环境变量

必需项：

```dotenv
NODE_ENV=production
MONGODB_URI=...
AUTH_SECRET=...
AUTH_URL=https://your-production-domain.example
NEXT_PUBLIC_APP_URL=https://your-production-domain.example
```

`AUTH_URL` 和 `NEXT_PUBLIC_APP_URL` 应使用同一个经过 HTTPS 终止的公开来源。不要用 `AUTH_TRUST_HOST=true` 代替明确来源，除非你已经审核并完全信任前置代理传入的 Host 头。

AI、OAuth 和职位 API 按功能配置，未配置时不得影响基础问答和 Code Lab。所有 secret 由部署平台注入，不进入镜像、构建日志或 `NEXT_PUBLIC_*`。

### 可观测性

```dotenv
OBSERVABILITY_ENABLED=true
NEXT_PUBLIC_OBSERVABILITY_ENABLED=true
NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE=0.1
# OBSERVABILITY_ENDPOINT=https://collector.example.com/events
# OBSERVABILITY_TOKEN=server-only-token
```

- 两个开关默认关闭，避免在未评审数据政策时意外采集。
- `NEXT_PUBLIC_OBSERVABILITY_ENABLED` 和采样率在构建时写入浏览器包，修改后必须重新构建。
- Web Vitals 每次页面加载只做一次采样决策，所有指标一起保留或丢弃，便于分析同一页加载。客户端/服务端错误不采样。
- 不配置 endpoint 时，事件仍会作为 Pino JSON 日志输出，所以不依赖任何第三方账号。
- 外部 endpoint 在生产环境必须是 HTTPS，服务端转发有 1.5 秒超时。不要指向项目自身的事件 Route。

## 4. Docker 部署

仓库使用 Next.js `output: "standalone"` 生成最小运行包，并提供非 root 用户运行的多阶段镜像：

```bash
docker build -t devflow .
docker run --env-file .env.production -p 3000:3000 devflow
```

环境变量只在运行容器时注入，不要把 `.env.production` 复制进镜像。镜像内置 `/api/health` 健康检查；数据库不可用时容器会报告 unhealthy，便于平台停止继续放量。

## 5. 数据库迁移

1. 备份生产数据库，确认恢复流程可用。
2. 在相同版本的预览库先执行 dry-run 和 `--apply`。
3. 生产库执行 `pnpm migrate:week2`、`week3`、`week7` 只读检查。
4. 对需要应用的迁移暂停写入，人工审核后添加 `--apply`。
5. 再次 dry-run，只有“无待处理项”才恢复流量。

不要在生产环境执行 `pnpm seed`。

## 6. 部署与发布后验证

```bash
pnpm start
```

部署平台将 `GET /api/health` 作为 readiness 检查：`200` 表示数据库可用，`503` 表示降级。发布后还要检查：

- 首页、`/playground`、登录页和一个问题详情页。
- 认证 Cookie 安全属性和 OAuth 回调域名。
- CSP、HSTS、`nosniff`、frame 限制和健康检查不泄露内部信息。
- 开启监控时，同源事件 Route 返回 `202`，并确认 `observabilitySchemaVersion` 事件字段中没有原始错误消息和用户数据。常规服务端诊断日志可包含异常堆栈，应限制日志平台访问和保留时间。

## 7. 告警与回滚

最低告警建议：5xx 比例、`/api/health` 连续失败、server-error 新 digest、client-error 新指纹、AI provider 502/超时，以及 LCP/INP/CLS “poor”比例。

回滚顺序：

1. 关闭新功能的外部配置或流量，保留健康检查。
2. 将应用回滚到上一个已验证构建产物，不要现场重新打包旧代码。
3. 数据库优先使用前向修复；只有迁移明确不可兼容时，才使用上线前备份恢复。
4. 使用 digest/指纹和发布时间线定位首个异常版本，完成复盘。
