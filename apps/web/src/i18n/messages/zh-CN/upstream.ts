import type { Messages } from "../../message-types";

export const upstream: Messages["upstream"] = {
	tab: "Upstream",
	title: "mock 未覆盖路由的 upstream",
	intro:
		"匹配 resource 或已启用 endpoint 的路由由 mock 响应；其他路由会连同 method、header 和 body 原样转发到 upstream。你的前端只需要一个 base URL：<code>{baseUrl}</code>。响应带有 <code>X-Localman-Source: mock</code> 或 <code>upstream</code>。",
	readonly:
		"你正以 collaborator 身份查看。只有 project 的 owner 可以更改 upstream 和遮盖的 header。",
	loading: "正在加载 upstream…",
	loadFailed: "无法加载 upstream 设置，请重试。",
	legend: "选择 upstream",
	options: {
		none: {
			title: "none",
			help: "不转发：未匹配的路由返回 404。",
		},
		tunnel: {
			title: "tunnel:<port>",
			help: "你电脑上的后端，通过你自己的 Tunelo tunnel 访问。",
		},
		url: {
			title: "URL",
			help: "已部署的后端，例如 staging 环境。仅接受公网 https。",
		},
	},
	port: {
		label: "端口",
		error: "端口必须在 1 到 65535 之间。",
	},
	unavailableNote:
		"tunnel 停止后，被转发的路由会收到 <code>502 UPSTREAM_UNAVAILABLE</code> 并附带命令提示。",
	url: {
		label: "Upstream URL",
		invalid: "请输入公网 https URL，例如 https://staging.example.com。",
		blocked: "该地址指向私有网络，Localman 无法转发到这里。",
	},
	save: "保存 upstream",
	saving: "正在保存…",
	saved:
		"已将 upstream 设为 <code>{label}</code>。mock 未覆盖的路由现在会转发到这里。",
	saveFailed: "无法保存 upstream",
	current: "当前使用：<code>{label}</code>",
	quotaNote:
		"所有发往 mock 的 request 都计入 mock request 额度，包括被转发的 request。",
	tunnel: {
		mapped: "已映射：<code>localhost:{port}</code> → <code>{url}</code>",
		missing:
			"<code>localhost:{port}</code> 还没有映射。运行 <code>tunelo http {port}</code>，然后在<link>API client 的 Tunelo</link>中添加映射。",
		unchecked:
			"保存后会检查 <code>localhost:{port}</code> 的 tunnel。要打开 tunnel，运行 <code>tunelo http {port}</code>，然后在<link>API client 的 Tunelo</link>中添加映射。",
		copy: "复制命令",
		copyFailed: "无法复制，请手动复制：{command}",
	},
	masked: {
		title: "遮盖的 header",
		intro:
			"这些 header 在 request log 中保存为 <code>[redacted]</code>。更改对此后记录的 request 生效。",
		always: "始终遮盖",
		custom: "此 project 额外遮盖",
		none: "还没有额外的 header。",
		inputLabel: "Header 名称",
		add: "添加 header",
		remove: "取消遮盖 {name}",
		invalid: "请输入 header 名称，例如 x-session-token。",
		duplicate: "该 header 已被遮盖。",
		max: "每个 project 最多 {max} 个额外 header。",
		saved: "已保存遮盖的 header。",
		saveFailed: "无法保存遮盖的 header",
	},
};
