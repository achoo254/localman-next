import type { Messages } from "../../message-types";

export const mcp: Messages["mcp"] = {
	tabs: {
		label: "Mock endpoint",
		rest: "REST",
		mcp: "MCP",
	},
	endpoint: {
		title: "MCP endpoint",
		urlLabel: "MCP URL",
		urlItem: "该 URL",
		urlHint:
			"工具直接操作 mock 自身的有状态数据：通过 MCP 创建后，REST GET 立即可见。每次调用工具计为 1 次 mock request。",
	},
	config: {
		title: "Agent 配置",
		legend: "配置格式",
		jsonLabel: "通用 JSON",
		hintOff: "无需 token：知道 MCP URL 的人都能调用，与 REST 相同。",
		hintOn:
			"配置从环境变量 <code>{env}</code> 读取 token。请在运行命令前设置该变量，或重新打开编辑器。",
		hintUnknown:
			"如果 project 要求 MCP token，请向 project 所有者索取 token，然后添加 header <code>Authorization: Bearer …</code>。",
		shellHint:
			"终端命令按 bash/zsh 编写（<code>${env}</code>）。在 PowerShell 中改为 <code>$env:{env}</code>，在 cmd 中改为 <code>%{env}%</code>。",
	},
	token: {
		title: "MCP 需要 token",
		loading: "正在加载 token 设置…",
		loadFailed: "无法加载 token 设置",
		helpOff:
			"默认与 REST 相同：知道 MCP URL 的人都能调用。开启后必须使用该 project 专属的 Bearer token。",
		helpOn:
			"缺少 header <code>Authorization: Bearer …</code> 的调用会收到 401。Token 只在创建时显示一次；丢失后请轮换新 token。",
		hint: "Token lmmcp_…{last4} · 创建于 {created}",
		rotate: "轮换 token",
		collaboratorNote:
			"MCP token 由 project 所有者管理。如果 MCP 需要 token，请向 project 所有者索取。",
		revealTitle: "立即保存 token",
		revealLabel: "MCP token",
		revealItem: "该 token",
		revealHint:
			"Token 只显示这一次，Localman 不保存可读副本。请将其放入变量 <code>{env}</code>，以便上面的配置使用。",
		revealDismiss: "我已保存 token",
	},
	dialogs: {
		enable: {
			title: "开启 MCP token",
			question: "为 {project} 开启 token 要求？",
			body: "未携带 token 调用 MCP 的 agent 会立即收到 401。",
			bodyNew: "新 token 只会在此步骤后显示一次。",
			bodyKept: "之前创建的 token（lmmcp_…{last4}）可以继续使用。",
			confirm: "开启 token",
			toast: "已开启 MCP token 要求。",
		},
		disable: {
			title: "关闭 MCP token",
			question: "关闭 token 要求？",
			body: "知道 MCP URL 的人都能调用，与 REST 相同。当前 token 会被保留；重新开启后可继续使用。",
			confirm: "关闭 token",
			toast: "已关闭 MCP token 要求。",
		},
		rotate: {
			title: "轮换 MCP token",
			question: "为 {project} 创建新的 MCP token？",
			body: "旧 token 会立即失效。使用旧 token 的 agent 会收到 401，直到你更新为新 token。",
			confirm: "轮换 token",
		},
	},
	tools: {
		title: "自动生成的工具",
		countUnit: { other: "个工具" },
		empty:
			"还没有工具。添加 resource 后即可获得该 resource 的 <code>list_</code>、<code>get_</code>、<code>create_</code>、<code>update_</code> 和 <code>delete_</code>。",
		allOff:
			"所有 endpoint 都已关闭，因此还没有工具。请在“编辑 resource”中开启 endpoint。",
		footnote:
			"已关闭的 endpoint 不会生成工具。MCP resources：<code>mock://schema</code>、<code>mock://openapi</code>。",
		readOnly: "只读",
		destructive: "破坏性",
		createParams: "符合 schema 的 body",
	},
	try: {
		button: "试用",
		intro:
			"MCP Inspector 是 MCP 官方的开源工具，通过 Node.js 在你的电脑上运行。在终端中运行下面的命令：Inspector 会在浏览器中打开界面，供你连接并逐个试用工具。",
		commandCaption: "Inspector",
		cliCaption: "在终端中快速检查",
		quota: "每次调用工具计为 1 次 request，计入你的 mock 额度。",
		docs: "MCP Inspector 文档",
	},
};
