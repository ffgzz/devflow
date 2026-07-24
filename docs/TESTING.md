# 测试与验收手册

DevFlow 把验证分为“快速纯逻辑 → 组件 → 真浏览器 → 真数据库”四层。这样既能快速反馈，也不会把“能 build”误当成“真实交互一定正常”。

## 1. 提交前最小检查

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm check:week3-search
pnpm check:week4
pnpm check:week56
pnpm check:week7
pnpm build
pnpm test:lighthouse
```

- `lint/typecheck`：静态边界、React/Next.js 规则和类型。
- `test:unit`：Vitest 纯逻辑与组件行为。
- `check:week*`：对项目特有协议做不依赖外部服务的回归检查。
- `build`：使用项目稳定的 webpack 生产路径。
- `test:lighthouse`：对生产构建执行性能、可访问性、SEO 和最佳实践预算。

本地 Lighthouse 默认测试不依赖数据库且允许索引的 `/playground`；CI 在临时 MongoDB 完成 Seed 后还会把首页纳入预算。登录页保持正确的 `noindex`，其表单无障碍由 Playwright 和人工回归验证，不参与 SEO 分数。首次运行也需要先安装 Playwright Chromium。

## 2. 浏览器端到端测试

首次在本机运行需要安装 Chromium：

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

需要调试交互时可使用 `pnpm test:e2e:ui`。不要将 `playwright-report/`、截图或 trace 中的真实账号信息提交到仓库。

## 3. 数据库验收

使用专用本地/预览数据库，不要对生产库执行 Seed：

```bash
pnpm health
pnpm seed
pnpm seed
pnpm migrate:week2
pnpm migrate:week3
pnpm migrate:week7
```

两次 Seed 用于验证幂等性。迁移默认都是 dry-run；只有人工审核报告后才使用 `--apply`。

## 4. 关键手工回归矩阵

| 用户路径 | 必验行为 | 故障行为 |
| --- | --- | --- |
| 登录/注册 | 成功跳转，未登录用户无法执行受保护操作 | OAuth 未配置时只显示通用错误，不泄露 provider 详情 |
| 发布问题 | 草稿恢复、标签和 Markdown 预览 | 请求失败时草稿仍在，可重试 |
| AI 分析 | 流式阶段、相似问题、Diff 单条应用/撤销 | 取消、超时、一次受控重试、额度不重复扣减 |
| 回答闭环 | 回答、投票、收藏、采纳/取消和通知深链 | 乐观更新失败回滚，重复操作不产生重复行 |
| 推荐信息流 | 推荐理由、无限滚动、不感兴趣和 Undo | 篡改/跨用户 Cursor 被拒绝，网络失败可重试 |
| 全局搜索 | `⌘/Ctrl+K`、分类、方向键和回答深链 | 快速输入时旧请求不覆盖新结果 |
| Code Lab | JS/HTML 运行、Stop、Reset、Fork 和刷新恢复 | 异常、超时、大日志和循环对象不拖垮主界面 |

## 5. 可观测性验收

在仅用于测试的 `.env.local` 中设置：

```dotenv
OBSERVABILITY_ENABLED=true
NEXT_PUBLIC_OBSERVABILITY_ENABLED=true
NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE=1
```

重启开发服务器并打开任意页面：

1. Network 中应出现 `POST /api/observability/events` 且返回 `202`。
2. 服务端应输出 `Observed Web Vital` 结构化日志。
3. 开发者工具执行 `Promise.reject(new Error("monitoring-test"))`，日志应只出现 `Error`、指纹和脱敏路径，不应出现 `monitoring-test` 或堆栈。
4. 将采样率改为 `0` 并重启，不应再有 Web Vitals；客户端异常仍应上报。
5. 关闭两个开关后，接口直接返回 `204`。

## 6. 发现失败时的证据

报告问题时至少附上：精确命令、退出码、第一个真实错误、浏览器/系统版本和可复现的最小操作。数据库 DNS/网络不可用与代码编译失败应分开记录。
