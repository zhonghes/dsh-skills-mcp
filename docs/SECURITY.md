# Security

## 值边界

- MCP 服务器定义里的 `env` 和 `headers` 只以 **key** 返回给浏览器；值从不进入 `GET /api/skills-mcp` 的响应、客户端状态或测试 fixture。
- 编辑时，已有 key 的值显示为掩码占位：留空表示保留，填写表示替换，删除 key 表示移除。Host 端在写 Settings 前合并，客户端从不回显旧值。
- `command`、`args`、`url`、`cwd` 按原值返回。把明文密钥直接写进这些字段不是本插件推荐的做法；请使用 `${credential:REF}` 模板，由 mcp-manager 解析。
- 技能决策只存名称、来源与路径等路由元数据，不存 SKILL.md 正文。

## 认证

- 路由挂在 DSH connection 的 `/api` 通道上，沿用 connection 的 loopback/可信主机认证。与 secret-variables 相同，不额外开放端口。
- 请求体上限 256KB；拒绝数组、原型键（`__proto__` / `constructor` / `prototype`）与非法名称。

## 写入

- MCP 定义的增删改经 `ctx.settings.describe()/mutate()`，走 profile 的 ConfigEditor、完整 Config 校验与 revision 检查；不会绕过 Settings 直接改写运行中的配置。
- 决策存储使用 0600 权限与原子替换（临时文件 + rename）。

## 已知边界

- 停用 MCP 定义会停止其进程；关闭可用性不会（它只是让该 agent 看不到工具、instructions 与 resource 调用）。
- 已经进入会话历史的内容不会因禁用而删除。
- 子代理按 root session 继承会话决策；root 无法解析时回退到自身。
