# Contributing

中文说明见文末。

## Ground rules

- **Never put a real secret in a test, fixture, issue, or commit.** MCP env/header tests use obviously fake values.
- One change per pull request; describe the user-visible effect.
- **No new runtime dependencies.** The plugin intentionally ships without any; test-only dependencies live in `devDependencies`.
- Do not import `@deepseek-ai/*` packages. The plugin uses only public Host services through `ctx.get` / `ctx.inject`.
- Keep the value boundary honest: env/header values must never appear in an HTTP response, log line, or client fixture.

## Development

```sh
npm install   # test dependencies only (React / happy-dom)
npm test      # host logic + client contract + UI smoke tests
npm run test:host
```

The Host suite needs no dependencies at all: `node --test test/*.test.js`. There is no build step. `client.js` runs directly in the Harness web UI; `src/` is plain ESM for the Host half.

When you change the Host half, disable and enable the plugin in the plugin manager to reload it; when you change `client.js`, refresh the page.

## Tests to keep green

- `src/core.js` decisions: nearest explicit wins, enabled overrides disabled, inherit clears.
- `src/gate.js`: all per-agent contributions go through `agent.ctx.inject(...)`; never access `agent.ctx.skills` / `tools` / `systemPrompt` directly (Cordis rejects that without the agent's own inject).
- `src/mcp.js`: masking, revision retry, user/base removal rules, validation.
- `src/http.js`: scope ids, body cap, error mapping.
- `client.js`: sidebar/main/conversation-view registrations, scope/type tabs, overridden rows, masked inputs, JSON add mode.

## Commit messages

Short imperative subject, a blank line, then why the change is needed. English or Chinese is fine.

## Pull request checklist

- [ ] `npm test` passes
- [ ] No real credentials, tokens, or personal paths in the diff
- [ ] `README.md` and `README.en.md` updated together when user-facing behavior changes
- [ ] `CHANGELOG.md` updated for a version-level change

---

## 中文

- 测试里禁止放真实密钥；MCP env/header 一律用明显假值。
- 一个 PR 只做一件事；无新增运行时依赖；不导入 `@deepseek-ai/*` 包。
- 改 Host 半需在插件管理器里禁用→启用；改 `client.js` 刷新页面即可。
- 不要在 `src/gate.js` 里直接访问 `agent.ctx.skills` / `tools` / `systemPrompt`。Cordis 会报 “cannot get property … without inject”；必须通过 `agent.ctx.inject([...], (scope) => ...)` 拿到 agent 层的子 scope。
- env/header 的值不能出现在 HTTP 响应、日志或客户端 fixture 里。
- 用户可见行为变化时，`README.md` 与 `README.en.md` 同步修改。
