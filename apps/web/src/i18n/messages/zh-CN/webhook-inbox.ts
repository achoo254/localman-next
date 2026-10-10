import type { Messages } from "../../message-types";

export const webhookInbox: Messages["webhookInbox"] = {
	title: "Webhook inbox",
	intro:
		"用于接收外部服务 webhook 的公开 URL。Inbox 接受任意 method，返回你设置的 response，并可通过 tunnel 转发到你的电脑。",
	count: "{used} / {max} 个 inbox",
	create: "创建 inbox",
	readonly:
		"你正以协作者身份查看。只有 project 的 owner 可以创建、修改和删除 inbox。",
	loading: "正在加载 inbox…",
	loadFailed: "无法加载 inbox，请重试。",
	footnote:
		"发往 inbox 的 request 会显示在 request log 中，来源为 <code>inbox</code>，敏感 header 会被遮盖，并计入 mock request 配额。",
	empty: {
		title: "还没有 inbox",
		body: "创建一个 inbox，把它的 URL 粘贴到发送方服务的 webhook 设置中，然后在 request log 中查看收到的 request。",
	},
	item: {
		response: "返回 {status} · {contentType}",
		forwards: "转发到 <code>{target}</code>",
		noForward: "不转发",
		requests: { other: "{count} 个 request" },
		viewLog: {
			other: "在 request log 中查看 inbox {name} 的 {count} 个 request",
		},
		url: "URL",
		urlItem: "inbox {name} 的 URL",
		lastForward: "最近一次转发",
		lastForwardAt: "最近一次转发 {time}",
		noForwardYet: "还没有需要转发的 request。",
		edit: "编辑 inbox {name}",
		delete: "删除 inbox {name}",
	},
	remove: {
		title: "删除 webhook inbox",
		question: "删除 inbox <code>{name}</code>？",
		body: "URL 会立即停止接收，发送方将收到 404。已记录的 request 会保留在 request log 中直到过期。",
		confirm: "删除 inbox",
		done: "已删除 inbox <code>{name}</code>。",
	},
	form: {
		titleNew: "创建 webhook inbox",
		titleEdit: "编辑 inbox {name}",
		name: "名称",
		nameHint: "小写字母、数字和 <code>-</code>，最多 32 个字符。",
		urlPreview: "URL：",
		responseTitle: "返回给发送方的 response",
		status: "Status",
		contentType: "Content-Type",
		body: "Body",
		forward: "转发到你的电脑（可选）",
		forwardHelp:
			"把每个 request 的副本发送到你的 tunnel。遇到网络错误、30 秒超时或 5xx 时最多重试 3 次。发送方仍会收到上面的 response。",
		port: "端口",
		path: "Path",
		target: "目标：<code>{target}</code>",
		submitNew: "创建 inbox",
		submitEdit: "保存 inbox",
		created:
			"已创建 inbox <code>{name}</code>。请把它的 URL 粘贴到发送方的 webhook 设置中。",
		saved: "已保存 inbox <code>{name}</code>。",
		forwardFailed:
			"已创建 inbox {name}，但未能开启转发：{reason} 请再次保存以重试。",
		errors: {
			nameEmpty: "请输入 inbox 名称。",
			nameFormat: "只能使用小写字母、数字和 -，且不能以 - 开头或结尾。",
			nameTaken: "此 project 已有同名 inbox。",
			status: "Status 须为 200 到 599 之间的整数。",
			bodyJson: "Body 不是有效的 JSON。如需发送纯文本，请切换 Content-Type。",
			port: "端口须在 1 到 65535 之间。",
			path: "Path 须以 / 开头，且不含空格、? 或 #。",
		},
	},
};
