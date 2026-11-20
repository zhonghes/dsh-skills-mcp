/**
 * Browser half: the scoped Skills & MCP page (global or project), the
 * conversation View tab, and the MCP form. Everything renders through slots
 * with plain React and theme tokens. Definitions are read masked; environment
 * and header values never reach this module.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-skills-mcp',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const NS = 'skills-mcp'
    const ROUTE = '/api/skills-mcp'

    const STRINGS = {
      zh: {
        'panel.title': '技能与 MCP',
        'view.title': '技能与 MCP',
        'tabs.skills': '技能',
        'tabs.mcp': 'MCP',
        'scope.global': '全局',
        'scope.workspace': '项目',
        'scope.session': '本会话',
        'source.project': '项目',
        'source.user': '用户',
        'source.userDsh': '用户 · DSH',
        'source.userAgents': '用户 · AGENTS',
        'source.projectDsh': '项目 · DSH',
        'source.projectAgents': '项目 · AGENTS',
        'source.bundled': '内置',
        'source.plugin': '插件',
        'source.custom': '自定义',
        'source.other': '其他',
        'group.user': '用户技能',
        'group.project': '项目技能',
        'group.bundled': '内置技能',
        'group.plugin': '插件技能',
        'group.custom': '自定义技能',
        'group.other': '其他技能',
        'group.definitions': '已配置的服务器',
        'group.plugins': '插件注册（自动）',
        'group.stored': '已失效的决策',
        'state.enabled': '启用',
        'state.enabledOnly': '只看已启用',
        'state.disabled': '已禁用',
        'state.inherit': '继承',
        'state.overridden': '覆盖',
        'state.missing': '未发现',
        'hint.definitionDisabled': '服务器定义已停用，任何作用域都不能启用它',
        'hint.inherit': '本层没有显式设置，沿用更宽作用域或默认值',
        'hint.unavailable': 'MCP 管理器或 Settings 服务未挂载，部分操作不可用',
        'action.add': '添加服务器',
        'action.enableAll': '全部启用',
        'action.disableAll': '全部关闭',
        'action.resetAll': '全部重置',
        'action.restoreInherit': '恢复继承',
        'action.resetRow': '重置',
        'hint.resetAll': '清除本组当前作用域的决策；项目/会话回到继承，全局回到默认。',
        'hint.info': '说明',
        'bulk.label': '批量操作',
        'action.save': '保存',
        'action.cancel': '取消',
        'action.close': '关闭',
        'action.refresh': '刷新',
        'action.edit': '编辑',
        'action.remove': '删除',
        'action.reset': '恢复组合定义',
        'action.probe': '探测',
        'action.restart': '重启',
        'action.enableDefinition': '启用定义',
        'action.disableDefinition': '停用定义',
        'action.details': '详情',
        'action.clear': '清除',
        'action.addKey': '添加',
        'action.removeKey': '移除',
        'field.name': '名称',
        'field.transport': '传输',
        'field.command': '命令',
        'field.args': '参数',
        'field.cwd': '工作目录',
        'field.url': 'URL',
        'field.headers': '请求头',
        'field.env': '环境变量',
        'field.definition': '定义',
        'field.tools': '工具',
        'field.status': '状态',
        'field.source': '来源',
        'field.path': '路径',
        'field.presets': '适用预设',
        'field.description': '说明',
        'field.whenToUse': '何时使用',
        'field.enabled': '启用',
        'field.startupTimeoutMs': '启动超时 (ms)',
        'field.toolCallTimeoutMs': '调用超时 (ms)',
        'field.key': '键',
        'field.workspace': '工作区',
        'field.scope': '作用域',
        'search.skills': '搜索技能…',
        'filter.all': '全部来源',
        'count.shown': '显示 {{shown}} / {{total}}',
        'field.value': '值',
        'field.invocation': '调用范围',
        'invocation.model': '模型可调用',
        'invocation.user': '用户可调用',
        'transport.stdio': 'stdio',
        'transport.http': 'streamable-http',
        'status.connected': '已连接',
        'status.connecting': '连接中',
        'status.reconnecting': '重连中',
        'status.waiting-credentials': '等待凭据',
        'status.failed': '失败',
        'status.disabled': '已停用',
        'status.missing': '定义缺失',
        'status.removed': '已移除',
        'status.closed': '已关闭',
        'status.unknown': '未知',
        'empty.skills': '当前作用域没有发现技能。',
        'empty.mcp': '还没有 MCP 服务器。',
        'empty.filtered': '当前会话没有启用的条目。',
        'empty.workspace': '先选择一个工作区。',
        'notice.global.skills': '这里的开关是所有作用域的默认值；项目和会话可以覆盖。',
        'notice.workspace.skills': '这里的开关只影响本项目；全局决策在这里显示为继承，本层设置后显示覆盖。',
        'notice.session.skills': '这里的开关只影响本会话；项目和全局决策在这里显示为继承，本层设置后显示覆盖。',
        'notice.mcp.project': '项目只覆盖可用性；添加、编辑、删除、启停定义请到全局 tab。',
        'notice.mcp.session': '本会话只覆盖可用性；添加、编辑、删除、启停定义请到全局 tab。',
        'notice.mcp': '关闭“可用性”只影响提示词和调用；要停止进程并彻底移除该服务器的提示词，请停用定义。',
        'notice.token': '软禁用仍会保留通用的 MCP resource 工具和一行服务器名单；停用定义才会完全消失。',
        'count.enabled': '已启用 {{enabled}} / {{total}}',
        'count.tools': '{{count}} 个工具',
        'warning.title': '提示',
        'error.load': '加载失败',
        'error.save': '保存失败',
        'probe.title': '探测结果',
        'form.addTitle': '添加 MCP 服务器',
        'form.editTitle': '编辑 MCP 服务器',
        'form.envHint': '已有值以掩码显示；留空表示保留，填写表示替换。',
        'form.headerHint': '已有值以掩码显示；留空表示保留，填写表示替换。',
        'form.argsHint': '每行一个参数，不进行 shell 解析。',
        'form.keepHint': '已设置（留空保留）',
        'form.modeForm': '表单',
        'form.modeJson': 'JSON',
        'form.jsonHint': '粘贴一个对象：name、transport，以及 stdio 的 command/args 或 http 的 url/headers；env/headers 用键值对象。只支持新增。',
        'form.jsonInvalid': 'JSON 格式不正确',
        'form.jsonObject': '必须是一个 JSON 对象',
        'confirm.removeTitle': '删除 MCP 服务器？',
        'confirm.removeText': '这会从 profile 配置中移除该服务器；进程会被停止。',
        'confirm.resetTitle': '恢复组合定义？',
        'confirm.resetText': '这会移除用户层覆盖，恢复组合提供的定义。',
        'mcp.noDefinition': '无定义',
        'mcp.auto': '自动',
        'mcp.definitionOn': '定义启用',
        'mcp.definitionOff': '定义已停用',
        'mcp.userOverride': '用户覆盖',
        'mcp.inherited': '组合提供',
        'mcp.stored': '仅存决策',
        'mcp.toolsTitle': '工具列表',
        'mcp.noTools': '没有已注册工具',
        'mcp.probeEmpty': '探测完成，没有返回内容。',
      },
      en: {
        'panel.title': 'Skills & MCP',
        'view.title': 'Skills & MCP',
        'tabs.skills': 'Skills',
        'tabs.mcp': 'MCP',
        'scope.global': 'Global',
        'scope.workspace': 'Project',
        'scope.session': 'This session',
        'source.project': 'Project',
        'source.user': 'User',
        'source.userDsh': 'User · DSH',
        'source.userAgents': 'User · AGENTS',
        'source.projectDsh': 'Project · DSH',
        'source.projectAgents': 'Project · AGENTS',
        'source.bundled': 'Built-in',
        'source.plugin': 'Plugin',
        'source.custom': 'Custom',
        'source.other': 'Other',
        'group.user': 'User skills',
        'group.project': 'Project skills',
        'group.bundled': 'Built-in skills',
        'group.plugin': 'Plugin skills',
        'group.custom': 'Custom skills',
        'group.other': 'Other skills',
        'group.definitions': 'Configured servers',
        'group.plugins': 'Plugin registrations (auto)',
        'group.stored': 'Stale decisions',
        'state.enabled': 'Enabled',
        'state.enabledOnly': 'Only enabled',
        'state.disabled': 'Disabled',
        'state.inherit': 'Inherited',
        'state.overridden': 'Overridden',
        'state.missing': 'Not found',
        'hint.definitionDisabled': 'The server definition is disabled; no scope can enable it',
        'hint.inherit': 'No explicit decision here; a wider scope or the default applies',
        'hint.unavailable': 'The MCP manager or Settings service is not mounted, so some actions are unavailable',
        'action.add': 'Add server',
        'action.enableAll': 'Enable all',
        'action.disableAll': 'Disable all',
        'action.resetAll': 'Reset all',
        'action.restoreInherit': 'Restore inheritance',
        'action.resetRow': 'Reset',
        'hint.resetAll': 'Clear this group’s decisions for the current scope; project/session inherit again, global returns to default.',
        'hint.info': 'About',
        'bulk.label': 'Bulk actions',
        'action.save': 'Save',
        'action.cancel': 'Cancel',
        'action.close': 'Close',
        'action.refresh': 'Refresh',
        'action.edit': 'Edit',
        'action.remove': 'Remove',
        'action.reset': 'Reset to composition',
        'action.probe': 'Probe',
        'action.restart': 'Restart',
        'action.enableDefinition': 'Enable definition',
        'action.disableDefinition': 'Disable definition',
        'action.details': 'Details',
        'action.clear': 'Clear',
        'action.addKey': 'Add',
        'action.removeKey': 'Remove',
        'field.name': 'Name',
        'field.transport': 'Transport',
        'field.command': 'Command',
        'field.args': 'Arguments',
        'field.cwd': 'Working directory',
        'field.url': 'URL',
        'field.headers': 'Headers',
        'field.env': 'Environment',
        'field.definition': 'Definition',
        'field.tools': 'Tools',
        'field.status': 'Status',
        'field.source': 'Source',
        'field.path': 'Path',
        'field.presets': 'Presets',
        'field.description': 'Description',
        'field.whenToUse': 'When to use',
        'field.enabled': 'Enabled',
        'field.startupTimeoutMs': 'Startup timeout (ms)',
        'field.toolCallTimeoutMs': 'Call timeout (ms)',
        'field.key': 'Key',
        'field.workspace': 'Workspace',
        'field.scope': 'Scope',
        'search.skills': 'Search skills…',
        'filter.all': 'All sources',
        'count.shown': 'Showing {{shown}} / {{total}}',
        'field.value': 'Value',
        'field.invocation': 'Invocation',
        'invocation.model': 'Model invocable',
        'invocation.user': 'User invocable',
        'transport.stdio': 'stdio',
        'transport.http': 'streamable-http',
        'status.connected': 'Connected',
        'status.connecting': 'Connecting',
        'status.reconnecting': 'Reconnecting',
        'status.waiting-credentials': 'Waiting for credentials',
        'status.failed': 'Failed',
        'status.disabled': 'Disabled',
        'status.missing': 'Definition missing',
        'status.removed': 'Removed',
        'status.closed': 'Closed',
        'status.unknown': 'Unknown',
        'empty.skills': 'No skills were discovered for this scope.',
        'empty.mcp': 'No MCP servers yet.',
        'empty.filtered': 'Nothing is enabled in this session.',
        'empty.workspace': 'Choose a workspace first.',
        'notice.global.skills': 'Switches here are the default for every scope; a project or session can override them.',
        'notice.workspace.skills': 'Switches here affect this project only; wider decisions show as inherited here, and as overridden after this layer sets one.',
        'notice.session.skills': 'Switches here affect this session only; project and global decisions show as inherited here, and as overridden after this layer sets one.',
        'notice.mcp.project': 'The project controls availability only; add, edit, remove, or toggle definitions in the Global tab.',
        'notice.mcp.session': 'This session controls availability only; add, edit, remove, or toggle definitions in the Global tab.',
        'notice.mcp': 'Turning availability off only changes prompts and calls. Disable the definition to stop the process and remove its prompt text entirely.',
        'notice.token': 'A soft-disabled server still keeps the shared MCP resource tools and one server-name line. Disable its definition for a total zero.',
        'count.enabled': 'Enabled {{enabled}} / {{total}}',
        'count.tools': '{{count}} tools',
        'warning.title': 'Notice',
        'error.load': 'Could not load',
        'error.save': 'Could not save',
        'probe.title': 'Probe result',
        'form.addTitle': 'Add MCP server',
        'form.editTitle': 'Edit MCP server',
        'form.envHint': 'Stored values are masked; leave blank to keep, type to replace.',
        'form.headerHint': 'Stored values are masked; leave blank to keep, type to replace.',
        'form.argsHint': 'One argument per line, without shell parsing.',
        'form.keepHint': 'Set (blank keeps it)',
        'form.modeForm': 'Form',
        'form.modeJson': 'JSON',
        'form.jsonHint': 'Paste one object: name, transport, then command/args for stdio or url/headers for http; env/headers are key-value objects. Add only.',
        'form.jsonInvalid': 'Invalid JSON',
        'form.jsonObject': 'Must be a JSON object',
        'confirm.removeTitle': 'Remove MCP server?',
        'confirm.removeText': 'This removes the server from the profile configuration and stops its process.',
        'confirm.resetTitle': 'Reset to composition definition?',
        'confirm.resetText': 'This removes the user-layer override and restores the composition entry.',
        'mcp.noDefinition': 'No definition',
        'mcp.auto': 'Auto',
        'mcp.definitionOn': 'Definition on',
        'mcp.definitionOff': 'Definition off',
        'mcp.userOverride': 'User override',
        'mcp.inherited': 'Composition',
        'mcp.stored': 'Decision only',
        'mcp.toolsTitle': 'Tools',
        'mcp.noTools': 'No registered tools',
        'mcp.probeEmpty': 'The probe finished without a result.',
      },
    }

    const COLOR = {
      text: 'var(--dsw-alias-label-primary)',
      secondary: 'var(--dsw-alias-label-secondary)',
      tertiary: 'var(--dsw-alias-label-tertiary)',
      border: 'var(--dsw-alias-border-l2)',
      layer: 'var(--dsw-alias-bg-layer-1)',
      base: 'var(--dsw-alias-bg-base)',
      accent: 'var(--dsw-alias-state-business-primary)',
      danger: 'var(--dsw-alias-state-error-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      hover: 'var(--dsw-alias-interactive-bg-hover)',
    }

    const CONTROL = 30
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

    const S = {
      page: {
        width: '100%', height: '100%', overflow: 'auto', boxSizing: 'border-box',
        padding: '0 clamp(24px, 4vw, 48px)', color: COLOR.text, fontSize: 14,
      },
      pageBody: { width: '100%', maxWidth: 960, margin: '0 auto', padding: '24px 0 48px', boxSizing: 'border-box' },
      header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, minHeight: 32 },
      title: { fontSize: 17, fontWeight: 600, margin: 0, lineHeight: '24px' },
      subtitle: { color: COLOR.secondary, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 },
      button: {
        height: CONTROL, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '0 12px', borderRadius: 8, border: `1px solid ${COLOR.border}`, background: 'transparent',
        color: COLOR.text, fontSize: 13, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none',
        fontFamily: 'inherit', boxSizing: 'border-box',
      },
      smallButton: { height: 26, padding: '0 9px', fontSize: 12, borderRadius: 7 },
      primary: { border: 'none', background: COLOR.accent, color: '#fff' },
      iconButton: { width: CONTROL, padding: 0 },
      linkButton: { border: 'none', background: 'transparent', color: COLOR.secondary, padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
      input: {
        height: CONTROL, width: '100%', minWidth: 0, padding: '0 10px', borderRadius: 8,
        border: `1px solid ${COLOR.border}`, background: COLOR.base, color: COLOR.text,
        fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
      },
      textarea: {
        width: '100%', minHeight: 76, padding: '8px 10px', borderRadius: 8,
        border: `1px solid ${COLOR.border}`, background: COLOR.base, color: COLOR.text,
        fontSize: 13, fontFamily: MONO, boxSizing: 'border-box', outline: 'none', resize: 'vertical',
      },
      check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLOR.text, whiteSpace: 'nowrap' },
      addRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '0 0 16px' },
      card: { border: `1px solid ${COLOR.border}`, borderRadius: 12, overflow: 'hidden', background: COLOR.layer },
      entry: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderTop: `1px solid ${COLOR.border}` },
      entryMain: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
      entryName: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' },
      name: { fontFamily: MONO, fontSize: 13, color: COLOR.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      description: { fontSize: 12.5, color: COLOR.secondary, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
      metaLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: COLOR.tertiary },
      side: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
      badge: { justifySelf: 'start', fontSize: 11, lineHeight: '16px', border: `1px solid ${COLOR.border}`, borderRadius: 999, padding: '0 8px', color: COLOR.secondary, whiteSpace: 'nowrap' },
      chip: (tone) => ({ fontSize: 11, lineHeight: '16px', border: `1px solid ${tone}`, borderRadius: 999, padding: '0 8px', color: tone, whiteSpace: 'nowrap' }),
      divider: { borderTop: `1px solid ${COLOR.border}` },
      group: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', borderTop: `1px solid ${COLOR.border}` },
      bulkActions: { display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginLeft: 'auto' },
      infoWrap: { position: 'relative', display: 'inline-flex' },
      rowResetButton: {
        height: 24, padding: '0 8px', borderRadius: 6, border: 'none',
        background: COLOR.accent, color: '#ffffff', fontSize: 11.5, fontWeight: 500,
        cursor: 'pointer', flex: 'none', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap',
      },
      rowResetButtonHover: { filter: 'brightness(0.92)' },
      rowResetButtonFocus: { boxShadow: `0 0 0 2px ${COLOR.accentBorder}` },
      infoButton: {
        width: 24, height: 24, padding: 0, borderRadius: '50%', border: `1px solid ${COLOR.borderStrong}`,
        background: 'transparent', color: COLOR.tertiary, fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      },
      infoPopover: {
        position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(380px, calc(100vw - 48px))', padding: 12,
        borderRadius: 10, background: COLOR.layer, color: COLOR.text, border: `1px solid ${COLOR.border}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.14)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        zIndex: 50, textAlign: 'left', boxSizing: 'border-box',
      },
      groupTitle: { fontSize: 12, fontWeight: 600, color: COLOR.secondary },
      groupHint: { fontSize: 11, color: COLOR.tertiary },
      tabsBar: { display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, margin: '14px 0 12px', borderBottom: `1px solid ${COLOR.border}` },
      tabs: { display: 'flex', flex: '1 1 auto', minWidth: 0, gap: 4 },
      tabsExtra: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, flex: 'none' },
      tab: { border: 'none', background: 'transparent', color: COLOR.secondary, fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', cursor: 'pointer', borderBottom: '2px solid transparent' },
      tabActive: { color: COLOR.text, borderBottom: `2px solid ${COLOR.accent}` },
      segmented: {
        display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8,
        background: COLOR.base, border: `1px solid ${COLOR.border}`,
      },
      segment: {
        height: 24, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent',
        color: COLOR.secondary, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      },
      segmentActive: { background: COLOR.accent, color: '#ffffff', fontWeight: 600, boxShadow: '0 1px 3px rgba(47,111,237,0.35)' },
      scopeRow: { display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px', flexWrap: 'wrap' },
      workspaceInline: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
      scopeLabel: { fontSize: 12, color: COLOR.secondary },
      scopeSelect: {
        height: 30, width: 190, padding: '0 8px', borderRadius: 8, border: `1px solid ${COLOR.border}`,
        background: COLOR.base, color: COLOR.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
      },
      toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '0 0 12px' },
      searchInput: {
        height: 30, width: 240, padding: '0 10px', borderRadius: 8, border: `1px solid ${COLOR.border}`,
        background: COLOR.base, color: COLOR.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
      },
      modeRow: {
        display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8,
        background: COLOR.base, border: `1px solid ${COLOR.border}`, marginBottom: 14,
      },
      banner: { border: `1px solid ${COLOR.border}`, borderRadius: 10, padding: '10px 12px', margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.6, color: COLOR.secondary },
      bannerWarn: { borderColor: COLOR.warn, color: COLOR.warn },
      error: { color: COLOR.danger, fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 },
      notice: { color: COLOR.tertiary, fontSize: 12, marginTop: 12, lineHeight: 1.6 },
      empty: { padding: '18px 14px', color: COLOR.tertiary, fontSize: 13 },
      dialogText: { fontSize: 13, lineHeight: 1.7, color: COLOR.text, margin: '0 0 10px' },
      dialogActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 },
      backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483000 },
      dialog: { width: 'min(900px, calc(100vw - 32px))', maxHeight: 'min(84vh, 780px)', overflow: 'auto', background: COLOR.layer, color: COLOR.text, borderRadius: 14, padding: 20, boxShadow: '0 18px 60px rgba(0,0,0,0.35)', border: `1px solid ${COLOR.border}`, boxSizing: 'border-box' },
      switch: (on) => ({
        position: 'relative', width: 34, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? COLOR.accent : COLOR.border, transition: 'background 120ms ease', flex: 'none',
      }),
      knob: (on) => ({ position: 'absolute', top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: 999, background: '#fff', transition: 'left 120ms ease' }),
      formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
      field: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
      label: { fontSize: 12, color: COLOR.secondary },
      kvRow: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(140px, 2fr) auto', gap: 8, alignItems: 'center', marginBottom: 6 },
      code: { fontFamily: MONO, fontSize: 11.5, color: COLOR.secondary, wordBreak: 'break-all', lineHeight: 1.5 },
      toolList: { margin: '4px 0 0', padding: '8px 12px', background: COLOR.base, borderRadius: 8, fontFamily: MONO, fontSize: 11.5, color: COLOR.secondary, display: 'flex', flexDirection: 'column', gap: 3 },
      pre: { margin: '8px 0 0', padding: 12, background: COLOR.base, borderRadius: 8, fontSize: 11.5, fontFamily: MONO, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
    }

    async function request(path, init) {
      const response = await fetch(`${ROUTE}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(init?.headers ?? {}),
        },
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.message ?? `HTTP ${response.status}`)
        error.code = body?.error
        throw error
      }
      return body.data
    }

    function useResource(load, deps) {
      const [version, setVersion] = React.useState(0)
      const [state, setState] = React.useState({ data: null, error: null, loading: true })
      const pending = React.useRef([])
      React.useEffect(() => {
        let alive = true
        setState((current) => ({ ...current, error: null, loading: true }))
        const settle = () => {
          const waiters = pending.current.splice(0)
          for (const resolve of waiters) resolve()
        }
        Promise.resolve()
          .then(load)
          .then((data) => {
            if (alive) {
              setState({ data: data ?? null, error: null, loading: false })
              settle()
            }
          })
          .catch((error) => {
            if (alive) {
              setState({ data: null, error: error?.message ?? String(error), loading: false })
              settle()
            }
          })
        return () => {
          alive = false
        }
      }, [...deps, version])
      React.useEffect(() => () => {
        const waiters = pending.current.splice(0)
        for (const resolve of waiters) resolve()
      }, [])
      return {
        ...state,
        reload: React.useCallback(() => new Promise((resolve) => {
          pending.current.push(resolve)
          setVersion((value) => value + 1)
        }), []),
      }
    }

    function usePolling(load, deps, interval) {
      const [version, setVersion] = React.useState(0)
      const [data, setData] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const tick = () => {
          Promise.resolve()
            .then(load)
            .then((next) => {
              if (alive) setData(next ?? null)
            })
            .catch(() => {})
        }
        tick()
        const timer = setInterval(tick, interval)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [...deps, version])
      return { data, reload: React.useCallback(() => setVersion((value) => value + 1), []) }
    }

    function fill(template, values) {
      let out = template
      for (const [key, value] of Object.entries(values)) out = out.split(`{{${key}}}`).join(String(value))
      return out
    }

    function Button({ children, onClick, primary, danger, title, disabled, style }) {
      return h('button', {
        type: 'button',
        title,
        disabled,
        onClick,
        style: {
          ...S.button,
          ...(primary ? S.primary : {}),
          ...(danger ? { color: COLOR.danger } : {}),
          ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}),
          ...(style ?? {}),
        },
      }, children)
    }

    function SmallButton({ children, ...rest }) {
      return h(Button, { ...rest, style: { ...S.smallButton, ...(rest.style ?? {}) } }, children)
    }

    function IconButton({ children, onClick, title, disabled }) {
      return h(Button, { onClick, title, disabled, style: S.iconButton }, children)
    }

    function Switch({ checked, onChange, label, disabled }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        title: label,
        disabled,
        onClick: () => onChange(!checked),
        style: { ...S.switch(checked), opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' },
      }, h('span', { style: S.knob(checked) }))
    }

    function Dialog({ open, title, onClose, wide, children }) {
      React.useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open, onClose])
      if (!open) return null
      const style = wide === true ? { ...S.dialog, width: 'min(1000px, calc(100vw - 32px))' } : S.dialog
      return ReactDOM.createPortal(
        h('div', { style: S.backdrop, onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() } },
          h('div', { style, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('div', { style: { ...S.header, marginBottom: 14 } },
              h('h2', { style: { ...S.title, fontSize: 16 } }, title),
              h('div', { style: { flex: 1 } }),
              h(IconButton, { onClick: onClose, title: 'Close' }, '✕')),
            children)),
        document.body,
      )
    }

    function Page({ children }) {
      return h('div', { style: S.page }, h('div', { style: S.pageBody }, children))
    }

    let spinStyleInjected = false
    function ensureSpinStyle() {
      if (spinStyleInjected || typeof document === 'undefined') return
      spinStyleInjected = true
      if (!document.head || document.getElementById('skills-mcp-spin-style')) return
      const style = document.createElement('style')
      style.id = 'skills-mcp-spin-style'
      style.textContent = '@keyframes dsh-skills-mcp-spin { to { transform: rotate(360deg); } }'
      document.head.appendChild(style)
    }

    function RefreshIcon({ spinning }) {
      React.useEffect(() => { ensureSpinStyle() }, [])
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        style: {
          display: 'block',
          transformOrigin: 'center',
          animation: spinning ? 'dsh-skills-mcp-spin 700ms linear infinite' : 'none',
        },
      },
      h('path', { d: 'M20 12a8 8 0 1 1-2.34-5.66', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
      h('path', { d: 'M20 4v5h-5', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function PageHeader({ t, title, summary, onRefresh, actions }) {
      const [refreshing, setRefreshing] = React.useState(false)
      React.useEffect(() => {
        if (!refreshing) return undefined
        const timer = window.setTimeout(() => setRefreshing(false), 600)
        return () => window.clearTimeout(timer)
      }, [refreshing])
      const triggerRefresh = async () => {
        if (refreshing) return
        setRefreshing(true)
        try {
          await onRefresh()
        } catch {
          // The page renders its own error state.
        } finally {
          setRefreshing(false)
        }
      }
      return h('div', { style: S.header },
        h('h1', { style: S.title }, title),
        summary === undefined ? null : h('span', { style: { ...S.badge, marginLeft: 2 } }, summary),
        h('div', { style: { flex: 1 } }),
        actions === undefined ? null : actions,
        onRefresh === undefined ? null : h(IconButton, {
          onClick: triggerRefresh,
          title: t('action.refresh'),
          disabled: refreshing,
        }, h(RefreshIcon, { spinning: refreshing })))
    }

    function Tabs({ t, tab, onChange, skills, mcp, extra }) {
      return h('div', { style: S.tabsBar },
        h('div', { style: S.tabs, role: 'tablist' },
          h('button', {
            type: 'button', role: 'tab', 'aria-selected': tab === 'skills',
            onClick: () => onChange('skills'), style: { ...S.tab, ...(tab === 'skills' ? S.tabActive : {}) },
          }, `${t('tabs.skills')} ${skills}`),
          h('button', {
            type: 'button', role: 'tab', 'aria-selected': tab === 'mcp',
            onClick: () => onChange('mcp'), style: { ...S.tab, ...(tab === 'mcp' ? S.tabActive : {}) },
          }, `${t('tabs.mcp')} ${mcp}`)),
        extra === undefined ? null : h('div', { style: S.tabsExtra }, extra))
    }

    function Banner({ children, warn }) {
      return h('div', { style: { ...S.banner, ...(warn ? S.bannerWarn : {}) } }, children)
    }

    function InfoTip({ text, label }) {
      const [open, setOpen] = React.useState(false)
      const ref = React.useRef(null)
      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('mousedown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])
      return h('div', { ref, style: S.infoWrap },
        h('button', {
          type: 'button',
          'aria-label': label,
          'aria-expanded': open,
          onClick: () => setOpen((value) => !value),
          style: S.infoButton,
        }, '?'),
        open ? h('div', { style: S.infoPopover }, text) : null)
    }

    function Group({ t, title, hint, children }) {
      return h('div', { style: { ...S.card, marginBottom: 14 } },
        h('div', { style: S.group },
          h('span', { style: S.groupTitle }, title),
          hint === undefined ? null : h('span', { style: S.groupHint }, hint)),
        children)
    }

    function BulkActions({ t, busy, canReset = true, onEnable, onDisable, onReset }) {
      return h('div', { style: S.bulkActions, role: 'group', 'aria-label': t('bulk.label') },
        h(SmallButton, { onClick: onEnable, disabled: busy }, t('action.enableAll')),
        h(SmallButton, { onClick: onDisable, disabled: busy }, t('action.disableAll')),
        canReset ? h(SmallButton, { onClick: onReset, disabled: busy, title: t('hint.resetAll') }, t('action.resetAll')) : null)
    }

    function emptyLine(t, key) {
      return h('div', { style: S.empty }, t(key))
    }

    function sourceKey(source) {
      if (typeof source !== 'string') return 'other'
      if (source.startsWith('project-')) return 'project'
      if (source.startsWith('user-')) return 'user'
      if (source === 'bundled') return 'bundled'
      if (source === 'runtime') return 'plugin'
      if (source === 'custom') return 'custom'
      return 'other'
    }

    const KNOWN_SOURCES = new Set(['user-dsh', 'user-agents', 'project-dsh', 'project-agents', 'bundled', 'runtime', 'custom'])

    function sourceLabel(t, source) {
      switch (source) {
        case 'user-dsh': return t('source.userDsh')
        case 'user-agents': return t('source.userAgents')
        case 'project-dsh': return t('source.projectDsh')
        case 'project-agents': return t('source.projectAgents')
        case 'bundled': return t('source.bundled')
        case 'runtime': return t('source.plugin')
        case 'custom': return t('source.custom')
        default: return typeof source === 'string' && source.length > 0 ? source : t('source.other')
      }
    }

    function filterSkills(rows, { query, sourceFilter, onlyEnabled }) {
      const needle = query.trim().toLowerCase()
      return rows.filter((row) => {
        if (onlyEnabled && row.effective?.state !== 'enabled') return false
        if (sourceFilter !== 'all') {
          if (sourceFilter === 'other') {
            if (KNOWN_SOURCES.has(row.source)) return false
          } else if (row.source !== sourceFilter) {
            return false
          }
        }
        if (needle.length === 0) return true
        return `${row.name} ${row.description ?? ''} ${row.source ?? ''} ${row.path ?? ''}`.toLowerCase().includes(needle)
      })
    }

    function SourceSelect({ t, value, onChange }) {
      return h('select', {
        value,
        'aria-label': t('field.source'),
        onChange: (event) => onChange(event.target.value),
        style: S.scopeSelect,
      },
      h('option', { value: 'all' }, t('filter.all')),
      h('optgroup', { label: t('group.user') },
        h('option', { value: 'user-dsh' }, t('source.userDsh')),
        h('option', { value: 'user-agents' }, t('source.userAgents'))),
      h('optgroup', { label: t('group.project') },
        h('option', { value: 'project-dsh' }, t('source.projectDsh')),
        h('option', { value: 'project-agents' }, t('source.projectAgents'))),
      h('option', { value: 'bundled' }, t('source.bundled')),
      h('option', { value: 'runtime' }, t('source.plugin')),
      h('option', { value: 'custom' }, t('source.custom')),
      h('option', { value: 'other' }, t('source.other')))
    }

    function SkillToolbar({ t, workspace, query, onQuery, sourceFilter, onSource, shown, total }) {
      return h('div', { style: S.toolbar },
        workspace === undefined ? null : workspace,
        h('input', {
          value: query,
          placeholder: t('search.skills'),
          onChange: (event) => onQuery(event.target.value),
          style: workspace === undefined ? S.searchInput : { ...S.searchInput, marginLeft: 'auto' },
        }),
        h(SourceSelect, { t, value: sourceFilter, onChange: onSource }),
        h('span', { style: { marginLeft: workspace === undefined ? 'auto' : 0, fontSize: 11, color: COLOR.tertiary } },
          fill(t('count.shown'), { shown, total })))
    }

    function ResetRowButton({ label, text, onClick }) {
      const [hover, setHover] = React.useState(false)
      const [focus, setFocus] = React.useState(false)
      return h('button', {
        type: 'button',
        title: label,
        'aria-label': label,
        onClick,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        onFocus: () => setFocus(true),
        onBlur: () => setFocus(false),
        style: {
          ...S.rowResetButton,
          ...(hover ? S.rowResetButtonHover : {}),
          ...(focus ? S.rowResetButtonFocus : {}),
        },
      }, text)
    }

    function OnlyEnabledToggle({ t, checked, onChange }) {
      return h('label', { style: S.check },
        h('input', {
          type: 'checkbox',
          checked,
          onChange: (event) => onChange(event.target.checked),
        }),
        t('state.enabledOnly'))
    }

    const SKILL_GROUP_ORDER = [
      ['user', 'group.user'], ['project', 'group.project'], ['bundled', 'group.bundled'],
      ['plugin', 'group.plugin'], ['custom', 'group.custom'], ['other', 'group.other'],
    ]

    function groupSkills(t, rows) {
      const map = new Map()
      for (const row of rows) {
        const key = sourceKey(row.source)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(row)
      }
      return SKILL_GROUP_ORDER
        .filter(([key]) => map.has(key))
        .map(([key, label]) => ({ key, title: t(label), rows: map.get(key) }))
    }

    function statusTone(state) {
      switch (state) {
        case 'connected': return COLOR.success
        case 'failed': return COLOR.danger
        case 'connecting': case 'reconnecting': case 'waiting-credentials': return COLOR.warn
        case 'disabled': case 'missing': case 'removed': case 'closed': return COLOR.tertiary
        default: return COLOR.secondary
      }
    }

    function statusKey(state) {
      const known = ['connected', 'connecting', 'reconnecting', 'waiting-credentials', 'failed', 'disabled', 'missing', 'removed', 'closed']
      return known.includes(state) ? `status.${state}` : 'status.unknown'
    }

    function decisionFor(item, scope) {
      return item?.decisions?.[scope]
    }

    function isPolicyEnabled(item, scope) {
      const explicit = decisionFor(item, scope)
      return explicit === undefined ? item?.effective?.state === 'enabled' : explicit.state === 'enabled'
    }

    function skillMeta(item) {
      return {
        ...(typeof item.description === 'string' && item.description.length > 0 ? { description: item.description } : {}),
        ...(typeof item.path === 'string' && item.path.length > 0 ? { path: item.path } : {}),
        ...(typeof item.source === 'string' && item.source.length > 0 ? { source: item.source } : {}),
        ...(typeof item.whenToUse === 'string' && item.whenToUse.length > 0 ? { whenToUse: item.whenToUse } : {}),
      }
    }

    function decisionBadge(t, item, scope) {
      if (scope === 'global') return null
      if (decisionFor(item, scope) === undefined) {
        return h('span', { style: { ...S.badge, color: COLOR.tertiary } }, t('state.inherit'))
      }
      return h('span', { style: S.chip(COLOR.warn) }, t('state.overridden'))
    }

    /** One skill row for the current scope. */
    function SkillRow({ t, item, scope, onToggle, onInherit, onDetails }) {
      const checked = isPolicyEnabled(item, scope)
      const hasLocal = decisionFor(item, scope) !== undefined
      return h('div', { 'data-skill-row': item.name, style: S.entry },
        h('div', { style: S.entryMain },
          h('div', { style: S.entryName },
            h('button', {
              type: 'button',
              onClick: () => onDetails?.(item),
              style: { ...S.linkButton, color: COLOR.text, fontFamily: MONO, fontSize: 13, textAlign: 'left' },
              title: t('action.details'),
            }, item.name),
            h('span', { style: S.badge }, sourceLabel(t, item.source)),
            item.missing === true ? h('span', { style: S.chip(COLOR.danger) }, t('state.missing')) : null,
            decisionBadge(t, item, scope)),
          item.description === undefined || item.description.length === 0
            ? null
            : h('div', { style: S.description }, item.description),
          h('div', { style: S.metaLine },
            h('span', null, `${t('field.presets')}: ${item.presets?.length > 0 ? item.presets.join(', ') : '—'}`),
            item.path === undefined ? null : h('span', { style: { fontFamily: MONO } }, item.path))),
        h('div', { style: S.side },
          h(Switch, {
            checked,
            label: item.name,
            onChange: (next) => onToggle?.(next ? 'enabled' : 'disabled', item),
          }),
          hasLocal && scope !== 'global'
            ? h(ResetRowButton, {
              label: t('action.restoreInherit'),
              text: t('action.resetRow'),
              onClick: () => onInherit?.(item),
            })
            : null))
    }

    /** One MCP row for the current scope. */
    function McpRow({
      t, item, scope, status, onToggle, onInherit, onProbe, onRestart, onEdit, onRemove, onReset,
      onDefinitionToggle, onTools, capabilities,
    }) {
      const checked = isPolicyEnabled(item, scope)
      const hasLocal = decisionFor(item, scope) !== undefined
      const definition = item.definition
      const definitionEnabled = item.definitionEnabled !== false
      const statusState = status?.state ?? item.status?.state ?? 'unknown'
      const toolCount = status?.toolCount ?? item.tools?.length ?? 0
      const origin = item.origin
      const definitionActions = scope === 'global'
      const isUser = item.definedIn === 'user'
      const hasBase = item.hasBase === true
      const canEdit = definitionActions && origin === 'definition' && capabilities?.settings !== false && capabilities?.writable !== false && typeof onEdit === 'function'
      const canToggleDefinition = definitionActions && origin === 'definition' && capabilities?.settings !== false && capabilities?.writable !== false && typeof onDefinitionToggle === 'function'
      const canReset = definitionActions && isUser && hasBase && typeof onReset === 'function'
      const canRemove = definitionActions && isUser && !hasBase && typeof onRemove === 'function'
      const canProbe = typeof onProbe === 'function' && origin !== 'stored'
      const canRestart = typeof onRestart === 'function' && origin !== 'stored'
      return h('div', { 'data-mcp-row': item.name, style: S.entry },
        h('div', { style: S.entryMain },
          h('div', { style: S.entryName },
            h('span', { style: S.name }, item.name),
            h('span', { style: S.chip(statusTone(statusState)), title: item.status?.lastError ?? item.status?.reason ?? '' }, t(statusKey(statusState))),
            origin === 'plugin' ? h('span', { style: S.badge }, t('mcp.auto')) : null,
            origin === 'stored' ? h('span', { style: S.chip(COLOR.danger) }, t('mcp.stored')) : null,
            decisionBadge(t, item, scope)),
          h('div', { style: S.metaLine },
            definition === null
              ? h('span', null, t('mcp.noDefinition'))
              : h('span', { style: definition.enabled === false ? { color: COLOR.warn } : undefined }, `${definition.transport === 'streamable-http' ? t('transport.http') : t('transport.stdio')} · ${definitionEnabled ? t('mcp.definitionOn') : t('mcp.definitionOff')}`),
            h('span', null, fill(t('count.tools'), { count: toolCount })),
            item.definedIn === 'user' ? h('span', null, t('mcp.userOverride')) : item.definedIn === 'base' ? h('span', null, t('mcp.inherited')) : null),
          item.tools?.length > 0
            ? h('div', { style: S.toolList }, item.tools.map((tool) => h('span', { key: tool.name, title: tool.description ?? '' }, tool.name)))
            : null,
          definition !== null
            ? h('div', { style: S.metaLine },
              h('span', { style: { fontFamily: MONO } }, definition.transport === 'streamable-http' ? definition.url : definition.command),
              definition.envKeys.length > 0 ? h('span', null, `env: ${definition.envKeys.join(', ')}`) : null,
              definition.headerKeys.length > 0 ? h('span', null, `headers: ${definition.headerKeys.join(', ')}`) : null)
            : null),
        h('div', { style: S.side },
          h(Switch, {
            checked,
            label: item.name,
            disabled: !definitionEnabled,
            onChange: (next) => {
              if (!definitionEnabled) return
              onToggle?.(next ? 'enabled' : 'disabled', item)
            },
          }),
          hasLocal && scope !== 'global'
            ? h(ResetRowButton, {
              label: t('action.restoreInherit'),
              text: t('action.resetRow'),
              onClick: () => onInherit?.(item),
            })
            : null,
          h(React.Fragment, null,
            canProbe ? h(SmallButton, { onClick: () => onProbe(item) }, t('action.probe')) : null,
            canRestart ? h(SmallButton, { onClick: () => onRestart(item) }, t('action.restart')) : null,
            canEdit ? h(SmallButton, { onClick: () => onEdit?.(item) }, t('action.edit')) : null,
            canToggleDefinition
              ? h(SmallButton, {
                onClick: () => onDefinitionToggle?.(item, definition?.enabled === false),
                title: definition?.enabled === false ? t('action.enableDefinition') : t('action.disableDefinition'),
                style: { color: definition?.enabled === false ? COLOR.accent : COLOR.warn },
              }, definition?.enabled === false ? t('action.enableDefinition') : t('action.disableDefinition'))
              : null,
            canReset ? h(SmallButton, { onClick: () => onReset(item) }, t('action.reset')) : null,
            canRemove ? h(SmallButton, { danger: true, onClick: () => onRemove(item) }, t('action.remove')) : null)))
    }

    function SkillDetails({ t, item, onClose }) {
      if (item === null || item === undefined) return null
      return h(Dialog, { open: true, title: item.name, onClose },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          item.description === undefined ? null : h('p', { style: S.dialogText }, item.description),
          item.whenToUse === undefined ? null : h('p', { style: S.dialogText }, `${t('field.whenToUse')}: ${item.whenToUse}`),
          h('div', { style: S.metaLine },
            h('span', null, `${t('field.source')}: ${sourceLabel(t, item.source)}`),
            h('span', null, `${t('field.presets')}: ${item.presets?.length > 0 ? item.presets.join(', ') : '—'}`)),
          item.path === undefined ? null : h('div', { style: S.code }, item.path),
          h('div', { style: S.metaLine },
            h('span', null, `${t('field.invocation')}: ${item.invocation?.modelInvocable === false ? '—' : t('invocation.model')}, ${item.invocation?.userInvocable === false ? '—' : t('invocation.user')}`)),
          h('div', { style: S.dialogActions }, h(Button, { onClick: onClose }, t('action.close')))))
    }

    function ConfirmDialog({ t, open, title, text, confirmLabel, danger, busy, onClose, onConfirm }) {
      return h(Dialog, { open, title, onClose },
        h('p', { style: S.dialogText }, text),
        h('div', { style: S.dialogActions },
          h(Button, { onClick: onClose, disabled: busy }, t('action.cancel')),
          h(Button, { onClick: onConfirm, primary: true, danger, disabled: busy }, confirmLabel)))
    }

    function KeyValueEditor({ t, label, rows, onChange, hint }) {
      const update = (index, patch) => {
        const next = rows.map((row, position) => (position === index ? { ...row, ...patch } : row))
        onChange(next)
      }
      return h('div', null,
        h('div', { style: { ...S.label, marginBottom: 6 } }, label),
        rows.map((row, index) => h('div', { key: row.id, style: S.kvRow },
          h('input', {
            value: row.key,
            placeholder: t('field.key'),
            onChange: (event) => update(index, { key: event.target.value }),
            style: S.input,
          }),
          h('input', {
            type: 'password',
            autoComplete: 'off',
            value: row.value,
            placeholder: row.present ? t('form.keepHint') : t('field.value'),
            onChange: (event) => update(index, { value: event.target.value }),
            style: S.input,
          }),
          h(SmallButton, { onClick: () => onChange(rows.filter((_, position) => position !== index)) }, t('action.removeKey')))),
        h(SmallButton, {
          onClick: () => onChange([...rows, { id: `row-${Date.now()}-${rows.length}`, key: '', value: '', present: false }]),
        }, t('action.addKey')),
        hint === undefined ? null : h('div', { style: S.notice }, hint))
    }

    function McpForm({ t, open, initial, onClose, onSaved }) {
      const [mode, setMode] = React.useState('form')
      const [json, setJson] = React.useState('')
      const [name, setName] = React.useState('')
      const [transport, setTransport] = React.useState('stdio')
      const [command, setCommand] = React.useState('')
      const [argsText, setArgsText] = React.useState('')
      const [cwd, setCwd] = React.useState('')
      const [url, setUrl] = React.useState('')
      const [envRows, setEnvRows] = React.useState([])
      const [headerRows, setHeaderRows] = React.useState([])
      const [startupTimeoutMs, setStartupTimeoutMs] = React.useState('')
      const [toolCallTimeoutMs, setToolCallTimeoutMs] = React.useState('')
      const [enabled, setEnabled] = React.useState(true)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const editing = initial !== null && initial !== undefined

      React.useEffect(() => {
        if (!open) return
        const definition = initial?.definition ?? null
        setName(initial?.name ?? '')
        setTransport(definition?.transport === 'streamable-http' ? 'streamable-http' : 'stdio')
        setCommand(definition?.command ?? '')
        setArgsText(Array.isArray(definition?.args) ? definition.args.join('\n') : '')
        setCwd(definition?.cwd ?? '')
        setUrl(definition?.url ?? '')
        setEnvRows((definition?.envKeys ?? []).map((key, index) => ({ id: `env-${index}-${key}`, key, value: '', present: true })))
        setHeaderRows((definition?.headerKeys ?? []).map((key, index) => ({ id: `header-${index}-${key}`, key, value: '', present: true })))
        setStartupTimeoutMs(definition?.startupTimeoutMs === undefined ? '' : String(definition.startupTimeoutMs))
        setToolCallTimeoutMs(definition?.toolCallTimeoutMs === undefined ? '' : String(definition.toolCallTimeoutMs))
        setEnabled(definition?.enabled !== false)
        setMode('form')
        setJson('')
        setError(null)
        setBusy(false)
      }, [open, initial])

      const patchOf = (rows, originalKeys) => {
        const set = {}
        const remove = []
        const presentKeys = new Set()
        for (const row of rows) {
          const key = row.key.trim()
          if (key.length === 0) continue
          if (row.present) presentKeys.add(key)
          if (row.value.length > 0 || !row.present) set[key] = row.value
        }
        for (const key of originalKeys) {
          if (!presentKeys.has(key)) remove.push(key)
        }
        return { set, remove }
      }

      const objectOf = (rows) => {
        const out = {}
        for (const row of rows) {
          const key = row.key.trim()
          if (key.length > 0) out[key] = row.value
        }
        return out
      }

      const argsOf = () => argsText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

      const toJson = () => {
        const entry = {
          name: name.trim() || 'my-server',
          transport,
          ...(transport === 'stdio'
            ? {
              command: command.trim() || 'npx',
              args: argsOf(),
              ...(cwd.trim().length === 0 ? {} : { cwd: cwd.trim() }),
              env: objectOf(envRows),
            }
            : {
              url: url.trim() || 'https://example.com/mcp',
              headers: objectOf(headerRows),
            }),
          enabled,
          ...(startupTimeoutMs.trim().length === 0 ? {} : { startupTimeoutMs: Number(startupTimeoutMs) }),
          ...(toolCallTimeoutMs.trim().length === 0 ? {} : { toolCallTimeoutMs: Number(toolCallTimeoutMs) }),
        }
        return JSON.stringify(entry, null, 2)
      }

      const rowsOf = (value, prefix) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
        return Object.entries(value).map(([key, val], index) => ({
          id: `${prefix}-${index}-${key}`,
          key,
          value: typeof val === 'string' ? val : '',
          present: false,
        }))
      }

      const fromJson = (text) => {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch (failure) {
          setError(`${t('form.jsonInvalid')}: ${failure.message}`)
          return false
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError(t('form.jsonObject'))
          return false
        }
        setName(typeof parsed.name === 'string' ? parsed.name : '')
        setTransport(parsed.transport === 'streamable-http' ? 'streamable-http' : 'stdio')
        setCommand(typeof parsed.command === 'string' ? parsed.command : '')
        setArgsText(Array.isArray(parsed.args) ? parsed.args.filter((arg) => typeof arg === 'string').join('\n') : '')
        setCwd(typeof parsed.cwd === 'string' ? parsed.cwd : '')
        setUrl(typeof parsed.url === 'string' ? parsed.url : '')
        setEnvRows(rowsOf(parsed.env, 'env'))
        setHeaderRows(rowsOf(parsed.headers, 'header'))
        setStartupTimeoutMs(Number.isFinite(parsed.startupTimeoutMs) ? String(parsed.startupTimeoutMs) : '')
        setToolCallTimeoutMs(Number.isFinite(parsed.toolCallTimeoutMs) ? String(parsed.toolCallTimeoutMs) : '')
        setEnabled(parsed.enabled !== false)
        setError(null)
        return true
      }

      const switchMode = (next) => {
        if (next === mode) return
        setError(null)
        if (next === 'json') {
          setJson((current) => (current.trim().length === 0 ? toJson() : current))
          setMode('json')
          return
        }
        if (fromJson(json)) setMode('form')
      }

      const post = async (payload) => {
        setBusy(true)
        try {
          await request('', { method: 'POST', body: JSON.stringify(payload) })
          onSaved?.()
          onClose()
        } catch (failure) {
          setError(failure?.message ?? String(failure))
        } finally {
          setBusy(false)
        }
      }

      const submitForm = async () => {
        setError(null)
        const trimmed = name.trim()
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(trimmed)) {
          setError(t('field.name') + ': [A-Za-z0-9_-]{1,32}')
          return
        }
        if (transport === 'stdio' && command.trim().length === 0) {
          setError(`${t('field.command')}: required`)
          return
        }
        if (transport === 'streamable-http' && url.trim().length === 0) {
          setError(`${t('field.url')}: required`)
          return
        }
        await post({
          op: editing ? 'updateMcp' : 'addMcp',
          name: trimmed,
          transport,
          ...(transport === 'stdio' ? {
            command: command.trim(),
            args: argsOf(),
            cwd: cwd.trim(),
            env: patchOf(envRows, (initial?.definition?.envKeys ?? [])),
          } : {
            url: url.trim(),
            headers: patchOf(headerRows, (initial?.definition?.headerKeys ?? [])),
          }),
          enabled,
          ...(startupTimeoutMs.trim().length === 0 ? {} : { startupTimeoutMs: Number(startupTimeoutMs) }),
          ...(toolCallTimeoutMs.trim().length === 0 ? {} : { toolCallTimeoutMs: Number(toolCallTimeoutMs) }),
        })
      }

      const submitJson = async () => {
        setError(null)
        let parsed
        try {
          parsed = JSON.parse(json)
        } catch (failure) {
          setError(`${t('form.jsonInvalid')}: ${failure.message}`)
          return
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError(t('form.jsonObject'))
          return
        }
        const trimmed = typeof parsed.name === 'string' ? parsed.name.trim() : ''
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(trimmed)) {
          setError(t('field.name') + ': [A-Za-z0-9_-]{1,32}')
          return
        }
        if (parsed.transport !== 'stdio' && parsed.transport !== 'streamable-http') {
          setError(`${t('field.transport')}: stdio | streamable-http`)
          return
        }
        const args = parsed.args === undefined ? [] : parsed.args
        if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
          setError(`${t('field.args')}: string[]`)
          return
        }
        const env = parsed.env
        if (env !== undefined && (typeof env !== 'object' || env === null || Array.isArray(env) || Object.values(env).some((value) => typeof value !== 'string'))) {
          setError(t('form.jsonObject'))
          return
        }
        const headers = parsed.headers
        if (headers !== undefined && (typeof headers !== 'object' || headers === null || Array.isArray(headers) || Object.values(headers).some((value) => typeof value !== 'string'))) {
          setError(t('form.jsonObject'))
          return
        }
        if (parsed.transport === 'stdio' && (typeof parsed.command !== 'string' || parsed.command.trim().length === 0)) {
          setError(`${t('field.command')}: required`)
          return
        }
        if (parsed.transport === 'streamable-http' && (typeof parsed.url !== 'string' || parsed.url.trim().length === 0)) {
          setError(`${t('field.url')}: required`)
          return
        }
        if (parsed.enabled !== undefined && typeof parsed.enabled !== 'boolean') {
          setError(`${t('field.enabled')}: boolean`)
          return
        }
        await post({
          op: 'addMcp',
          name: trimmed,
          transport: parsed.transport,
          ...(parsed.transport === 'stdio' ? {
            command: parsed.command.trim(),
            args,
            cwd: typeof parsed.cwd === 'string' ? parsed.cwd : '',
            env: { set: env ?? {}, remove: [] },
          } : {
            url: parsed.url.trim(),
            headers: { set: headers ?? {}, remove: [] },
          }),
          ...(parsed.enabled === undefined ? {} : { enabled: parsed.enabled }),
          ...(Number.isInteger(parsed.startupTimeoutMs) ? { startupTimeoutMs: parsed.startupTimeoutMs } : {}),
          ...(Number.isInteger(parsed.toolCallTimeoutMs) ? { toolCallTimeoutMs: parsed.toolCallTimeoutMs } : {}),
        })
      }

      const submit = () => (mode === 'json' && !editing ? submitJson() : submitForm())

      const modeToggle = editing
        ? null
        : h('div', { style: S.modeRow },
          h('button', {
            type: 'button',
            'aria-pressed': mode === 'form',
            onClick: () => switchMode('form'),
            style: { ...S.segment, ...(mode === 'form' ? S.segmentActive : {}) },
          }, t('form.modeForm')),
          h('button', {
            type: 'button',
            'aria-pressed': mode === 'json',
            onClick: () => switchMode('json'),
            style: { ...S.segment, ...(mode === 'json' ? S.segmentActive : {}) },
          }, t('form.modeJson')))

      const actions = h('div', { style: S.dialogActions },
        h(Button, { onClick: onClose, disabled: busy }, t('action.cancel')),
        h(Button, { onClick: submit, primary: true, disabled: busy }, t('action.save')))

      if (mode === 'json' && !editing) {
        return h(Dialog, { open, title: t('form.addTitle'), onClose, wide: true },
          modeToggle,
          h('div', { style: S.label }, t('form.jsonHint')),
          h('textarea', {
            value: json,
            onChange: (event) => setJson(event.target.value),
            spellCheck: false,
            style: { ...S.textarea, minHeight: 320, marginTop: 8 },
          }),
          error === null ? null : h('div', { style: { ...S.error, marginTop: 10 } }, error),
          actions)
      }

      return h(Dialog, { open, title: editing ? t('form.editTitle') : t('form.addTitle'), onClose, wide: true },
        modeToggle,
        h('div', { style: S.formGrid },
          h('label', { style: S.field },
            h('span', { style: S.label }, t('field.name')),
            h('input', { value: name, disabled: editing, onChange: (event) => setName(event.target.value), style: S.input, placeholder: 'github' })),
          h('label', { style: S.field },
            h('span', { style: S.label }, t('field.transport')),
            h('select', { value: transport, onChange: (event) => setTransport(event.target.value), style: S.input },
              h('option', { value: 'stdio' }, t('transport.stdio')),
              h('option', { value: 'streamable-http' }, t('transport.http')))),
          transport === 'stdio'
            ? h('label', { style: S.field },
              h('span', { style: S.label }, t('field.command')),
              h('input', { value: command, onChange: (event) => setCommand(event.target.value), style: S.input, placeholder: 'npx' }))
            : h('label', { style: S.field },
              h('span', { style: S.label }, t('field.url')),
              h('input', { value: url, onChange: (event) => setUrl(event.target.value), style: S.input, placeholder: 'https://example.com/mcp' })),
          h('label', { style: S.field },
            h('span', { style: S.label }, t('field.startupTimeoutMs')),
            h('input', { value: startupTimeoutMs, inputMode: 'numeric', onChange: (event) => setStartupTimeoutMs(event.target.value), style: S.input })),
          h('label', { style: S.field },
            h('span', { style: S.label }, t('field.toolCallTimeoutMs')),
            h('input', { value: toolCallTimeoutMs, inputMode: 'numeric', onChange: (event) => setToolCallTimeoutMs(event.target.value), style: S.input })),
          transport === 'stdio'
            ? h('label', { style: S.field },
              h('span', { style: S.label }, t('field.cwd')),
              h('input', { value: cwd, onChange: (event) => setCwd(event.target.value), style: S.input }))
            : h('div', null)),
        transport === 'stdio'
          ? h('div', { style: { marginTop: 14 } },
            h('div', { style: { ...S.label, marginBottom: 5 } }, t('field.args')),
            h('textarea', { value: argsText, onChange: (event) => setArgsText(event.target.value), style: S.textarea }),
            h('div', { style: S.notice }, t('form.argsHint')),
            h('div', { style: { marginTop: 14 } },
              h(KeyValueEditor, { t, label: t('field.env'), rows: envRows, onChange: setEnvRows, hint: t('form.envHint') })))
          : h('div', { style: { marginTop: 14 } },
            h(KeyValueEditor, { t, label: t('field.headers'), rows: headerRows, onChange: setHeaderRows, hint: t('form.headerHint') })),
        h('label', { style: { ...S.check, marginTop: 14 } },
          h('input', { type: 'checkbox', checked: enabled, onChange: (event) => setEnabled(event.target.checked) }),
          t('field.enabled')),
        error === null ? null : h('div', { style: { ...S.error, marginTop: 10 } }, error),
        actions)
    }

    function ProbeDialog({ t, open, result, error, onClose }) {
      return h(Dialog, { open, title: t('probe.title'), onClose },
        error === null || error === undefined
          ? (result === null || result === undefined
            ? h('p', { style: S.dialogText }, t('mcp.probeEmpty'))
            : h('pre', { style: S.pre }, JSON.stringify(result, null, 2)))
          : h('div', { style: S.error }, error?.message ?? String(error)),
        h('div', { style: S.dialogActions }, h(Button, { onClick: onClose }, t('action.close'))))
    }

    function mergeStatus(servers, status) {
      const map = new Map((status?.servers ?? []).map((server) => [server.name, server]))
      return (servers ?? []).map((server) => {
        const live = map.get(server.name)
        return live === undefined ? server : { ...server, status: live.status, tools: server.tools }
      })
    }

    function warningBanner(t, warnings) {
      const list = Array.isArray(warnings) ? warnings : []
      if (list.length === 0) return null
      return h(Banner, { warn: true },
        h('strong', null, `${t('warning.title')}: `),
        list.map((warning) => warning.message ?? warning.code).join(' · '))
    }

    // ------------------------------------------------------------------ panel
    const WORKSPACE_STORAGE = 'skills-mcp:workspace'
    function rememberedWorkspace() {
      try {
        return window.localStorage.getItem(WORKSPACE_STORAGE)
      } catch {
        return null
      }
    }
    function rememberWorkspace(id) {
      try {
        window.localStorage.setItem(WORKSPACE_STORAGE, id)
      } catch {
        // Storage is optional; the in-memory selection still works.
      }
    }

    function ScopePanel(props) {
      const { t } = props
      const [scope, setScope] = React.useState('global')
      const [tab, setTab] = React.useState('skills')
      const [workspaceId, setWorkspaceId] = React.useState(null)
      const [query, setQuery] = React.useState('')
      const [sourceFilter, setSourceFilter] = React.useState('all')
      const [onlyEnabled, setOnlyEnabled] = React.useState(false)
      const [details, setDetails] = React.useState(null)
      const [form, setForm] = React.useState({ open: false, initial: null })
      const [confirm, setConfirm] = React.useState(null)
      const [probe, setProbe] = React.useState({ open: false, result: null, error: null })
      const [failure, setFailure] = React.useState(null)
      const [bulkBusy, setBulkBusy] = React.useState(false)
      const overview = useResource(() => request('?op=overview'), [])
      const workspaces = overview.data?.workspaces ?? []
      const scopeKey = scope === 'global' ? 'global' : 'workspace'

      React.useEffect(() => {
        if (scope !== 'project') return
        if (workspaces.length === 0) {
          if (workspaceId !== null) setWorkspaceId(null)
          return
        }
        if (workspaceId !== null && workspaces.some((workspace) => workspace.id === workspaceId)) return
        const remembered = rememberedWorkspace()
        const next = workspaces.find((workspace) => workspace.id === remembered)?.id ?? workspaces[0].id
        setWorkspaceId(next)
      }, [scope, workspaces, workspaceId])

      const skills = useResource(() => {
        if (scope === 'global') return request('?op=skills&scope=global')
        if (workspaceId === null) return null
        return request(`?op=skills&scope=workspace&workspaceId=${encodeURIComponent(workspaceId)}`)
      }, [scope, workspaceId])
      const mcp = useResource(() => {
        if (scope === 'global') return request('?op=mcp&scope=global')
        if (workspaceId === null) return null
        return request(`?op=mcp&scope=workspace&workspaceId=${encodeURIComponent(workspaceId)}`)
      }, [scope, workspaceId])
      const status = usePolling(() => request('?op=mcpStatus'), [], 5000)

      const reload = () => {
        skills.reload()
        mcp.reload()
        status.reload()
      }
      const run = async (body) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify(body) })
          reload()
        } catch (error) {
          setFailure(error?.message ?? String(error))
        }
      }
      const changeScope = (next) => {
        setFailure(null)
        setScope(next)
      }
      const changeWorkspace = (next) => {
        setWorkspaceId(next)
        rememberWorkspace(next)
      }
      const scopeBody = scope === 'project' && workspaceId !== null ? { workspaceId } : {}
      const runBulk = async (bodies) => {
        if (bulkBusy || bodies.length === 0) return
        setBulkBusy(true)
        setFailure(null)
        try {
          const results = await Promise.allSettled(bodies.map((body) => request('', {
            method: 'POST',
            body: JSON.stringify(body),
          })))
          const failed = results.find((result) => result.status === 'rejected')
          if (failed !== undefined) setFailure(failed.reason?.message ?? String(failed.reason))
        } finally {
          setBulkBusy(false)
          reload()
        }
      }
      const runSkillBulk = (rows, nextState) => runBulk(rows.map((row) => ({
        op: 'setSkillDecision',
        scope: scopeKey,
        ...scopeBody,
        name: row.name,
        state: nextState,
        ...(nextState === 'inherit' ? {} : { meta: skillMeta(row) }),
      })))
      const runMcpBulk = (rows, nextState) => runBulk((nextState === 'inherit'
        ? rows
        : rows.filter((row) => row.definitionEnabled !== false)).map((row) => ({
        op: 'setMcpDecision',
        scope: scopeKey,
        ...scopeBody,
        name: row.name,
        state: nextState,
      })))
      const setSkillDecision = (row, state) => run({
        op: 'setSkillDecision',
        scope: scopeKey,
        ...scopeBody,
        name: row.name,
        state,
        ...(state === 'inherit' ? {} : { meta: skillMeta(row) }),
      })
      const setMcpDecision = (row, state) => run({
        op: 'setMcpDecision',
        scope: scopeKey,
        ...scopeBody,
        name: row.name,
        state,
      })
      const probeServer = async (server) => {
        setFailure(null)
        try {
          const result = await request('', { method: 'POST', body: JSON.stringify({ op: 'probeMcp', name: server.name }) })
          setProbe({ open: true, result, error: null })
        } catch (error) {
          setProbe({ open: true, result: null, error })
        }
      }
      const restartServer = (server) => run({ op: 'restartMcp', name: server.name })

      const skillRows = skills.data?.skills ?? []
      const servers = mergeStatus(mcp.data?.servers ?? [], status.data)
      const caps = mcp.data?.capabilities ?? {}
      const filteredSkills = filterSkills(skillRows, { query, sourceFilter, onlyEnabled })
      const groups = groupSkills(t, filteredSkills)
      const filteredServers = onlyEnabled ? servers.filter((server) => server.effective.state === 'enabled') : servers
      const definitionGroup = filteredServers.filter((server) => server.origin === 'definition')
      const pluginGroup = filteredServers.filter((server) => server.origin === 'plugin')
      const storedGroup = filteredServers.filter((server) => server.origin === 'stored')
      const enabledCount = skillRows.filter((row) => row.effective.state === 'enabled').length
      const hasWorkspace = workspaces.length > 0
      const projectBlocked = scope === 'project' && !hasWorkspace
      const projectLoading = scope === 'project' && hasWorkspace && workspaceId === null

      const scopeControl = h('div', { style: S.segmented, role: 'group', 'aria-label': t('field.scope') },
        h('button', {
          type: 'button',
          'data-scope': 'global',
          'aria-pressed': scope === 'global',
          onClick: () => changeScope('global'),
          style: { ...S.segment, ...(scope === 'global' ? S.segmentActive : {}) },
        }, t('scope.global')),
        h('button', {
          type: 'button',
          'data-scope': 'project',
          'aria-pressed': scope === 'project',
          onClick: () => changeScope('project'),
          style: { ...S.segment, ...(scope === 'project' ? S.segmentActive : {}) },
        }, t('scope.workspace')))

      const workspaceControl = scope === 'project'
        ? h('div', { style: S.workspaceInline },
          h('span', { style: S.scopeLabel }, t('field.workspace')),
          hasWorkspace
            ? h('select', {
              value: workspaceId ?? '',
              'aria-label': t('field.workspace'),
              onChange: (event) => changeWorkspace(event.target.value),
              style: S.scopeSelect,
            }, workspaces.map((workspace) => h('option', {
              key: workspace.id,
              value: workspace.id,
            }, workspace.title ?? workspace.path ?? workspace.id)))
            : h('span', { style: S.scopeLabel }, t('empty.workspace')))
        : null
      const scopeRow = workspaceControl === null ? null : h('div', { style: S.scopeRow }, workspaceControl)

      const renderSkill = (item) => h(SkillRow, {
        key: item.name,
        t,
        item,
        scope: scopeKey,
        onToggle: (state, row) => setSkillDecision(row, state),
        onInherit: scope === 'project' ? (row) => setSkillDecision(row, 'inherit') : undefined,
        onDetails: setDetails,
      })

      const renderServer = (item) => h(McpRow, {
        key: item.name,
        t,
        item,
        scope: scopeKey,
        status: item.status,
        capabilities: caps,
        onToggle: (state, row) => setMcpDecision(row, state),
        onInherit: scope === 'project' ? (row) => setMcpDecision(row, 'inherit') : undefined,
        onProbe: probeServer,
        onRestart: restartServer,
        ...(scope === 'global' ? {
          onEdit: (row) => setForm({ open: true, initial: row }),
          onDefinitionToggle: (row, enabled) => run({ op: 'setMcpEnabled', name: row.name, enabled }),
          onRemove: (row) => setConfirm({ kind: 'remove', row }),
          onReset: (row) => setConfirm({ kind: 'reset', row }),
        } : {}),
      })

      const skillNotice = scope === 'global' ? t('notice.global.skills') : t('notice.workspace.skills')
      const mcpNotice = [t('notice.mcp'), t('notice.token'), scope === 'project' ? t('notice.mcp.project') : null]
        .filter(Boolean)
        .join('\n')
      const skillsEmptyKey = skillRows.length === 0 ? 'empty.skills' : 'empty.filtered'
      const mcpEmptyKey = servers.length === 0 ? 'empty.mcp' : 'empty.filtered'

      return h(Page, null,
        h(PageHeader, {
          t,
          title: t('panel.title'),
          summary: fill(t('count.enabled'), { enabled: enabledCount, total: skillRows.length }),
          actions: scopeControl,
          onRefresh: () => {
            status.reload()
            return Promise.all([overview.reload(), skills.reload(), mcp.reload()])
          },
        }),
        h(Tabs, {
          t,
          tab,
          onChange: setTab,
          skills: skillRows.length,
          mcp: servers.length,
          extra: h(React.Fragment, null,
            h(OnlyEnabledToggle, { t, checked: onlyEnabled, onChange: setOnlyEnabled }),
            tab === 'skills'
              ? (filteredSkills.length === 0 ? null : h(BulkActions, {
                t,
                busy: bulkBusy,
                canReset: scope !== 'global',
                onEnable: () => runSkillBulk(filteredSkills, 'enabled'),
                onDisable: () => runSkillBulk(filteredSkills, 'disabled'),
                onReset: () => runSkillBulk(filteredSkills, 'inherit'),
              }))
              : (filteredServers.length === 0 ? null : h(BulkActions, {
                t,
                busy: bulkBusy,
                canReset: scope !== 'global',
                onEnable: () => runMcpBulk(filteredServers, 'enabled'),
                onDisable: () => runMcpBulk(filteredServers, 'disabled'),
                onReset: () => runMcpBulk(filteredServers, 'inherit'),
              })),
            h(InfoTip, { text: tab === 'skills' ? skillNotice : mcpNotice, label: t('hint.info') })),
        }),
        tab === 'mcp' ? scopeRow : null,
        failure === null ? null : h('div', { style: S.error }, failure),
        warningBanner(t, [...(skills.data?.warnings ?? []), ...(mcp.data?.warnings ?? [])]),
        projectBlocked
          ? h(Group, { t, title: t('group.project') }, emptyLine(t, 'empty.workspace'))
          : projectLoading
            ? h('div', { style: S.empty }, t('empty.workspace'))
            : tab === 'skills'
              ? h(React.Fragment, null,
                h(SkillToolbar, {
                  t,
                  workspace: scope === 'project' ? workspaceControl : undefined,
                  query,
                  onQuery: setQuery,
                  sourceFilter,
                  onSource: setSourceFilter,
                  shown: filteredSkills.length,
                  total: skillRows.length,
                }),
                groups.length === 0
                  ? h(Group, { t, title: t('group.user') }, emptyLine(t, skillsEmptyKey))
                  : groups.map((group) => h(Group, { key: group.key, t, title: group.title },
                    group.rows.map(renderSkill))))
              : h(React.Fragment, null,
                scope === 'global'
                  ? h('div', { style: S.addRow },
                    h(Button, {
                      primary: true,
                      disabled: caps.settings === false || caps.writable === false,
                      onClick: () => setForm({ open: true, initial: null }),
                    }, t('action.add')))
                  : null,
                caps.mcp === false ? h(Banner, { warn: true }, t('hint.unavailable')) : null,
                definitionGroup.length === 0 && pluginGroup.length === 0 && storedGroup.length === 0
                  ? h(Group, { t, title: t('group.definitions') }, emptyLine(t, mcpEmptyKey))
                  : null,
                definitionGroup.length === 0 ? null : h(Group, { t, title: t('group.definitions') },
                  definitionGroup.map(renderServer)),
                pluginGroup.length === 0 ? null : h(Group, { t, title: t('group.plugins') },
                  pluginGroup.map(renderServer)),
                storedGroup.length === 0 ? null : h(Group, { t, title: t('group.stored') },
                  storedGroup.map(renderServer))),
        h(SkillDetails, { t, item: details, onClose: () => setDetails(null) }),
        h(McpForm, {
          t,
          open: form.open,
          initial: form.initial,
          onClose: () => setForm({ open: false, initial: null }),
          onSaved: reload,
        }),
        h(ConfirmDialog, {
          t,
          open: confirm !== null,
          title: confirm?.kind === 'reset' ? t('confirm.resetTitle') : t('confirm.removeTitle'),
          text: confirm?.kind === 'reset' ? t('confirm.resetText') : t('confirm.removeText'),
          confirmLabel: confirm?.kind === 'reset' ? t('action.reset') : t('action.remove'),
          danger: confirm?.kind !== 'reset',
          busy: false,
          onClose: () => setConfirm(null),
          onConfirm: () => {
            const current = confirm
            setConfirm(null)
            if (current?.kind === 'reset') run({ op: 'resetMcp', name: current.row.name })
            else run({ op: 'removeMcp', name: current?.row?.name })
          },
        }),
        h(ProbeDialog, {
          t,
          open: probe.open,
          result: probe.result,
          error: probe.error,
          onClose: () => setProbe({ open: false, result: null, error: null }),
        }))
    }

    // ---------------------------------------------------------- session view
    function SessionView(props) {
      const { t, sessionId } = props
      const [tab, setTab] = React.useState('skills')
      const [query, setQuery] = React.useState('')
      const [sourceFilter, setSourceFilter] = React.useState('all')
      const [onlyEnabled, setOnlyEnabled] = React.useState(false)
      const [failure, setFailure] = React.useState(null)
      const [bulkBusy, setBulkBusy] = React.useState(false)
      const [details, setDetails] = React.useState(null)
      const [probe, setProbe] = React.useState({ open: false, result: null, error: null })
      const skills = useResource(
        () => sessionId ? request(`?op=skills&scope=session&sessionId=${encodeURIComponent(sessionId)}`) : null,
        [sessionId],
      )
      const mcp = useResource(
        () => sessionId ? request(`?op=mcp&scope=session&sessionId=${encodeURIComponent(sessionId)}`) : null,
        [sessionId],
      )
      const status = usePolling(() => sessionId ? request('?op=mcpStatus') : null, [sessionId], 5000)
      const reload = () => { skills.reload(); mcp.reload(); status.reload() }
      const run = async (body) => {
        setFailure(null)
        try {
          await request('', { method: 'POST', body: JSON.stringify(body) })
          reload()
        } catch (error) {
          setFailure(error?.message ?? String(error))
        }
      }
      const runBulk = async (bodies) => {
        if (bulkBusy || bodies.length === 0) return
        setBulkBusy(true)
        setFailure(null)
        try {
          const results = await Promise.allSettled(bodies.map((body) => request('', {
            method: 'POST',
            body: JSON.stringify(body),
          })))
          const failed = results.find((result) => result.status === 'rejected')
          if (failed !== undefined) setFailure(failed.reason?.message ?? String(failed.reason))
        } finally {
          setBulkBusy(false)
          reload()
        }
      }
      const runSkillBulk = (rows, nextState) => runBulk(rows.map((row) => ({
        op: 'setSkillDecision',
        scope: 'session',
        sessionId,
        name: row.name,
        state: nextState,
        ...(nextState === 'inherit' ? {} : { meta: skillMeta(row) }),
      })))
      const runMcpBulk = (rows, nextState) => runBulk((nextState === 'inherit'
        ? rows
        : rows.filter((row) => row.definitionEnabled !== false)).map((row) => ({
        op: 'setMcpDecision',
        scope: 'session',
        sessionId,
        name: row.name,
        state: nextState,
      })))
      const probeServer = async (server) => {
        setFailure(null)
        try {
          const result = await request('', { method: 'POST', body: JSON.stringify({ op: 'probeMcp', name: server.name }) })
          setProbe({ open: true, result, error: null })
        } catch (error) {
          setProbe({ open: true, result: null, error })
        }
      }
      const restartServer = (server) => run({ op: 'restartMcp', name: server.name })
      if (!sessionId) return h(Page, null, h('div', { style: S.empty }, t('empty.skills')))

      const allSkillRows = skills.data?.skills ?? []
      const filteredSkills = filterSkills(allSkillRows, { query, sourceFilter, onlyEnabled })
      const skillGroups = groupSkills(t, filteredSkills)
      const allServers = mergeStatus(mcp.data?.servers ?? [], status.data)
      const servers = onlyEnabled ? allServers.filter((row) => row.effective.state === 'enabled') : allServers
      const definitionGroup = servers.filter((server) => server.origin === 'definition')
      const pluginGroup = servers.filter((server) => server.origin === 'plugin')
      const storedGroup = servers.filter((server) => server.origin === 'stored')
      const caps = mcp.data?.capabilities ?? {}
      const enabledSkills = allSkillRows.filter((row) => row.effective.state === 'enabled').length
      const skillsEmptyKey = allSkillRows.length === 0 ? 'empty.skills' : 'empty.filtered'
      const mcpEmptyKey = allServers.length === 0 ? 'empty.mcp' : 'empty.filtered'
      const mcpNotice = [t('notice.mcp'), t('notice.token'), t('notice.mcp.session')].join('\n')

      const renderSkill = (item) => h(SkillRow, {
        key: item.name,
        t,
        item,
        scope: 'session',
        onToggle: (next, row) => run({
          op: 'setSkillDecision',
          scope: 'session',
          sessionId,
          name: row.name,
          state: next,
          meta: skillMeta(row),
        }),
        onInherit: (row) => run({ op: 'setSkillDecision', scope: 'session', sessionId, name: row.name, state: 'inherit' }),
        onDetails: setDetails,
      })

      const renderServer = (item) => h(McpRow, {
        key: item.name,
        t,
        item,
        scope: 'session',
        status: item.status,
        capabilities: caps,
        onToggle: (next, row) => run({ op: 'setMcpDecision', scope: 'session', sessionId, name: row.name, state: next }),
        onInherit: (row) => run({ op: 'setMcpDecision', scope: 'session', sessionId, name: row.name, state: 'inherit' }),
        onProbe: probeServer,
        onRestart: restartServer,
      })

      return h(Page, null,
        h(PageHeader, {
          t,
          title: t('view.title'),
          summary: fill(t('count.enabled'), { enabled: enabledSkills, total: allSkillRows.length }),
          onRefresh: () => {
            status.reload()
            return Promise.all([skills.reload(), mcp.reload()])
          },
        }),
        h(Tabs, {
          t,
          tab,
          onChange: setTab,
          skills: allSkillRows.length,
          mcp: allServers.length,
          extra: h(React.Fragment, null,
            h(OnlyEnabledToggle, { t, checked: onlyEnabled, onChange: setOnlyEnabled }),
            tab === 'skills'
              ? (filteredSkills.length === 0 ? null : h(BulkActions, {
                t,
                busy: bulkBusy,
                onEnable: () => runSkillBulk(filteredSkills, 'enabled'),
                onDisable: () => runSkillBulk(filteredSkills, 'disabled'),
                onReset: () => runSkillBulk(filteredSkills, 'inherit'),
              }))
              : (servers.length === 0 ? null : h(BulkActions, {
                t,
                busy: bulkBusy,
                onEnable: () => runMcpBulk(servers, 'enabled'),
                onDisable: () => runMcpBulk(servers, 'disabled'),
                onReset: () => runMcpBulk(servers, 'inherit'),
              })),
            h(InfoTip, { text: tab === 'skills' ? t('notice.session.skills') : mcpNotice, label: t('hint.info') })),
        }),
        failure === null ? null : h('div', { style: S.error }, failure),
        warningBanner(t, [...(skills.data?.warnings ?? []), ...(mcp.data?.warnings ?? [])]),
        tab === 'skills'
          ? h(React.Fragment, null,
            h(SkillToolbar, {
              t,
              query,
              onQuery: setQuery,
              sourceFilter,
              onSource: setSourceFilter,
              shown: filteredSkills.length,
              total: allSkillRows.length,
            }),
            skillGroups.length === 0
              ? h(Group, { t, title: t('group.user') }, emptyLine(t, skillsEmptyKey))
              : skillGroups.map((group) => h(Group, { key: group.key, t, title: group.title },
                group.rows.map(renderSkill))))
          : h(React.Fragment, null,
            definitionGroup.length === 0 && pluginGroup.length === 0 && storedGroup.length === 0
              ? h(Group, { t, title: t('group.definitions') }, emptyLine(t, mcpEmptyKey))
              : null,
            definitionGroup.length === 0 ? null : h(Group, { t, title: t('group.definitions') },
              definitionGroup.map(renderServer)),
            pluginGroup.length === 0 ? null : h(Group, { t, title: t('group.plugins') },
              pluginGroup.map(renderServer)),
            storedGroup.length === 0 ? null : h(Group, { t, title: t('group.stored') },
              storedGroup.map(renderServer))),
        h(SkillDetails, { t, item: details, onClose: () => setDetails(null) }),
        h(ProbeDialog, {
          t,
          open: probe.open,
          result: probe.result,
          error: probe.error,
          onClose: () => setProbe({ open: false, result: null, error: null }),
        }))
    }

    // ------------------------------------------------------------------ icon
    function Icon() {
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M6 4h5a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H6z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
        h('path', { d: 'M18 4h-5a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h5z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
        h('path', { d: 'M8 9h2M8 12h2M14 9h2M14 12h2', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
        h('path', { d: 'M16 17v3m0 0h2m-2 0h-2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))
    }

    // ---------------------------------------------------------------- plugin
    const plugin = {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, STRINGS), 'skills-mcp: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'skills-mcp',
          order: 21,
          locale: NS,
          label: () => t('panel.title'),
        }, Icon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'skills-mcp',
          locale: NS,
          inject: () => ({ t }),
        }, ScopePanel))

        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view',
          id: 'skills-mcp',
          order: 21,
          locale: NS,
          label: () => t('view.title'),
          inject: () => ({ t }),
        }, SessionView))

      },
    }

    return plugin
  },
})
