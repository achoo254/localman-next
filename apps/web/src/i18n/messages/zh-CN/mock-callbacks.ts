import type { Messages } from "../../message-types";

export const mockCallbacks: Messages["mockCallbacks"] = {
	title: "Callbacks",
	subtitle: "记录通过 mock 变更时发送 request",
	add: "添加 callback",
	max: "每个 resource 最多 {max} 个 callback。",
	readonly: "你正以协作者身份查看。只有 project 的 owner 可以编辑 callback。",
	empty:
		"还没有 callback。添加一个后，mock 会在 create、update 或 delete 时向你的服务器发送 request。",
	variables:
		"变量：<code>{record}</code> 为 JSON 格式的记录，<code>{field}</code> 为记录的某个 field，<code>{event}</code> 为 create、update 或 delete，<code>{resource}</code> 为 resource 名称。在后台发送，失败时按间隔最多重试 3 次；结果写入 request log，来源为 <code>callback</code>。",
	loading: "正在加载 callback…",
	loadFailed: "无法加载 callback，请重试。",
	unsaved: "有未保存的更改",
	invalid: "有 callback 无效，请检查标记的字段。",
	item: {
		enable: "启用 callback {n}",
		event: "callback {n} 的事件",
		on: "触发于",
		remove: "移除 callback {n}",
		target: "目标",
		targetPlaceholder:
			"https://hooks.example.com/users 或 tunnel:3000/hooks/users",
		body: "Body 模板",
		headers: "Header",
		headerName: "Header 名称 {i}",
		headerValue: "Header 值 {i}",
		valuePlaceholder: "值",
		hiddenPlaceholder: "已隐藏",
		hiddenHint: "已隐藏的值会保持原样，除非你输入新值。",
		addHeader: "添加 header",
		removeHeader: "移除 header {name}",
	},
	test: {
		send: "发送测试",
		sent: "已向 <code>{target}</code> 发送测试 callback。",
		failed: {
			other: "向 <code>{target}</code> 发送测试失败，已尝试 {count} 次。",
		},
		busy: "还有其他测试正在进行，请等待完成后重试。",
		result: "测试 <code>{target}</code>：",
		response: "Response body",
		truncated: "已截断至 64 KB。",
	},
	last: {
		never: "尚未发送。",
		sent: "最近一次发送 {time}：",
		attempts: "{ms} ms，尝试 {n}/{max} 次",
	},
	errors: {
		targetEmpty: "请输入 https URL 或 tunnel:<port><path>。",
		targetHttp:
			"只接受 https。如需发送到你的电脑，请使用 tunnel:<port><path>。",
		targetFormat:
			"目标应为 https URL 或 tunnel:<port><path>，例如 tunnel:3000/hooks/users。",
		targetPort: "端口须在 1 到 65535 之间。",
		body: "替换变量后 body 不是有效的 JSON。注意 {record} 不要放在引号内。",
		bodyTooLarge: "Body 模板过大：最多 64 KB。",
		headerName: "请使用有效的 header 名称，例如 X-Hook-Secret。",
		headerReserved: "{name} 由 Localman 设置，请使用其他 header。",
		headerValue: "Header 值只能有一行。",
		headerMax: "每个 callback 最多 {max} 个 header。",
		headersRefused: "服务器拒绝了某个 header，请检查名称和值。",
	},
	delivery: {
		attempts: "发送尝试，最多 {max} 次",
		attempt: "第 {n}/{max} 次",
		ms: "{ms} ms",
		answered: "返回 {status}",
		errors: {
			noTunnel: "此端口没有 tunnel 映射",
			connect: "无法连接",
			timeout: "超时",
			dns: "无法解析主机名",
			blocked: "已拦截：私有或保留地址",
			bodyTooLarge: "Body 过大，无法发送",
			invalidTarget: "目标无效",
			queueFull: "此账号等待发送的请求过多，未发送",
			quotaExceeded: "本月 mock 请求额度已用完，未发送",
			expired: "一小时内未能送达，已放弃",
		},
	},
};
