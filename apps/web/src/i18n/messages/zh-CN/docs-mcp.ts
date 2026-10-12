import type { Messages } from "../../message-types";

export const docsMcp: Messages["docs"]["mcp"] = {
	lead: "通过 MCP（Model Context Protocol）让 AI 编程 agent 访问你的 mock。每个 project 都为自己的数据提供 Hosted Mock MCP；Localman MCP 用于管理你的 project 和 resource。",
	hosted: {
		title: "Hosted Mock MCP",
		url: "每个 project 都有一个 MCP endpoint，地址为 <code>{url}</code>，即 mock URL 加上 <code>/mcp</code>，使用 Streamable HTTP。Project 页面的 MCP 标签页会显示准确的 URL，以及 Claude Code、Cursor 等客户端的现成配置。",
		caption: "Project 的 Hosted Mock MCP URL",
		tools:
			"工具根据 resource 自动生成：<code>list_</code>、<code>get_</code>、<code>create_</code>、<code>update_</code> 和 <code>delete_</code> 加上 resource 名称，覆盖所有 resource（包括嵌套的），且只为已开启的 endpoint 生成。它们与 REST 操作同一份数据，所以通过 MCP 创建的记录在 REST 中立即可见。嵌套 resource 需要 <code>parentId</code>；<code>list_</code> 接受与 REST 相同的 query 参数，返回 <code>{listShape}</code>。",
		resources:
			"两个 MCP resource 描述了 mock：<code>mock://schema</code>（resource 树、嵌套路由、schema、endpoint 以及每个 resource 的工具）和 <code>mock://openapi</code>（已开启 endpoint 的 OpenAPI 3.1）。",
		token:
			"和 REST 一样，拿到 URL 的人都能调用这个 endpoint。Project 所有者可以在 MCP 标签页中要求 MCP 使用 token：开启后调用需要 <code>Authorization: Bearer lmmcp_…</code>，token 缺失或错误返回 401。Token 只在创建时显示一次。",
		limits:
			"每次工具调用计为 project 所有者每月 mock 额度中的 1 次 request，并与 REST 共用速率限制；超出限制时工具返回错误 <code>RATE_LIMITED</code> 或 <code>MONTHLY_QUOTA_EXCEEDED</code>。Custom response 不适用于 MCP 结果。",
		limitsFree:
			"每次工具调用计为 project 所有者每月 mock 额度中的 1 次 request（默认每月 {requests} 次 request），并与 REST 共用速率限制；超出限制时工具返回错误 <code>RATE_LIMITED</code> 或 <code>MONTHLY_QUOTA_EXCEEDED</code>。Custom response 不适用于 MCP 结果。",
	},
	localman: {
		title: "Localman MCP",
		intro:
			"Localman MCP 的地址是 <code>{url}</code>，agent 可以用它管理你的 project 和 resource：创建 project，从 TypeScript、OpenAPI 或 JSON Schema 类型添加 resource，生成数据，读取 mock URL。它以你的身份操作，权限和额度限制与网页版相同。",
		signIn:
			"Agent 通过 OAuth 使用你在 <code>{idp}</code> 的 hoandat 账号登录：客户端会自动注册，并打开浏览器让你授权。<code>mock:read</code> 允许读取 project、resource、数据和 mock URL（包括 secret）；<code>mock:write</code> 允许修改它们。创建凭据的工具还会请求 <code>credentials:write</code>。",
		claudeAfter:
			"然后在 Claude Code 中运行 <code>/mcp</code>，选择 <code>localman</code> 登录。",
		cursorAfter: "Cursor 首次连接时会打开登录页面。",
		limits:
			"Request 按账号限速；超出限制时返回 429，并带有 <code>Retry-After</code> header。",
	},
	tools: {
		title: "Localman MCP 的工具",
		intro:
			"Localman MCP 提供 <code>mock</code> 工具集，也就是 OAuth 授权的工具集。只读工具需要 <code>mock:read</code>，其他工具需要 <code>mock:write</code>。",
		caption: "Mock 工具集的工具",
		headerTool: "工具",
		headerScopes: "Scope",
		headerConfirm: "确认",
		headerSummary: "作用",
		confirmNone: "无",
		confirmOptional: "<code>dry_run</code> 可选",
		confirmRequired: "先 <code>dry_run</code>，再 <code>confirm_token</code>",
		confirmFlow: {
			other:
				"{count} 个工具会一次性修改或删除大量数据，因此分两步执行：先带 <code>dry_run: true</code> 调用，获取预览和 <code>confirm_token</code>，再带上该 <code>confirm_token</code> 调用以执行。标记为可选的工具接受 <code>dry_run</code> 预览，但不强制。",
		},
	},
	toolSummaries: {
		listProjects: "列出 mock project",
		getProject: "获取单个 mock project",
		createProject: "创建 mock project",
		updateProject: "重命名 mock project 或修改其 prefix",
		deleteProject: "删除 mock project 及其全部内容",
		cloneProject: "克隆 mock project",
		rotateProjectSecret: "为 mock project 生成新的 secret（新的 mock URL）",
		getMcpTokenSettings: "查看 mock project 的 MCP endpoint 是否需要 token",
		setMcpTokenRequired:
			"要求（或取消要求）mock 的 MCP endpoint 使用 Bearer token",
		rotateMcpToken: "更换 mock 的 MCP endpoint 的 Bearer token",
		listResources: "列出 mock project 的 resource 树",
		createResource: "在 mock project 中创建 resource",
		getResource: "获取 mock project 的单个 resource",
		updateResource: "重命名 resource，或修改其 schema、template 或 endpoint",
		createResourceFromSchema:
			"从 TypeScript、OpenAPI 或 JSON Schema 类型创建 resource",
		deleteResource: "删除 resource 及其子 resource 和记录",
		moveResource: "将 resource 嵌套到另一个 resource 下，或移到根级",
		listFakerMethods:
			"列出可在 resource schema 和 template 中使用的 Faker 方法",
		generateResourceData: "用生成的数据替换 resource 的记录",
		generateAllResourceData: "重新生成 project 中每个 resource 的记录",
		resetAllResourceData: "删除 project 中每个 resource 的记录",
		getResourceData: "获取 resource 的原始记录",
		replaceResourceData: "用 JSON 数组替换 resource 的记录",
		getMockUrls: "获取 mock project 的 REST 和 MCP URL",
	},
};
