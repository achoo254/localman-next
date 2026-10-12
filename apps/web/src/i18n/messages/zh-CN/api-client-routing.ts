import type { Messages } from "../../message-types";

export const apiClientRouting: Messages["apiClientRouting"] = {
	rail: { routing: "路由" },
	badge: {
		direct: "直连",
		local: "直连（localhost）",
		proxy: "经代理",
		proxyCors: "经代理 · CORS 拦截",
		tunelo: "经 Tunelo",
	},
	via: { proxy: "代理", tunelo: "你的 Tunelo 隧道" },
	why: {
		manual: {
			direct: "你为此请求选择了直连（Send 旁的选项）。",
			proxy: "你为此请求选择了代理（Send 旁的选项）。",
			tunelo: "你为此请求选择了代理；本地地址通过其 Tunelo 隧道发送。",
		},
		direct:
			"从浏览器直接发送到 {host}；目标允许 CORS。请求没有经过 Localman 服务器。",
		local: "从浏览器直接发送到你网络中的 {host}。凭据没有离开你的设备。",
		pinned: "{host} 在“始终经代理”列表中（路由设置）。",
		forbidden:
			"浏览器不允许用 fetch 设置 {headers}，因此请求经 {via} 发送以保留它。",
		redirects:
			"“跟随重定向”已关闭，而浏览器无法显示重定向响应，因此请求经 {via} 发送。",
		remembered:
			"{host} 最近直连失败（通常是 CORS），因此请求直接经 {via} 发送。可在路由设置中清除。",
		cors: "直连失败（TypeError，通常缺少 CORS），因此请求已经 {via} 重新发送。24 小时内 {host} 将直接走这条路。",
	},
	note: {
		cors: "已经 {via} 发送：浏览器拦截了直连",
		dropped: "浏览器省略了 {headers}",
		droppedHint: "fetch 无法设置这些请求头。在 Send 旁选择代理即可保留。",
	},
	failure: {
		blocked:
			"浏览器拒绝直接发送到 {host}：CORS、混合内容、本地网络权限，或目标未运行。",
		timeout: "{host} 在超时时间内没有响应。",
		redirect: "{host} 返回了重定向，而“跟随重定向”关闭时浏览器无法显示它。",
		interrupted:
			"{host} 已响应，但读取响应时连接中断。请求已在目标上执行，因此没有自动重发。",
		notRetried:
			"直连 {host} 失败，但这个请求（POST 或 PATCH）可能已到达目标，因此没有自动重发。",
		tunnel: "{key} 在你的设备上：代理无法访问，且尚未为它设置隧道。",
		consent: "未发送：请求带有凭据，需要你同意后才能经代理发送。",
	},
	direct: {
		title: {
			blocked: "TypeError: Failed to fetch · {host}",
			timeout: "{host} 没有响应",
			redirect: "重定向被浏览器隐藏",
			interrupted: "响应被中断 · {host}",
			notRetried: "未重发 · {host}",
		},
		sendProxy: "经代理发送",
		tryTunelo: "尝试经 Tunelo",
		useAuto: "使用 Auto",
	},
	consent: {
		title: "经代理发送？",
		body: "无法从浏览器直接访问 {target}：{reason}。请求带有 {parts}。",
		destination: "代理将调用 {url}",
		reason: {
			pinned: "该主机被固定为经代理",
			forbidden: "包含浏览器不允许设置的请求头",
			redirects: "“跟随重定向”已关闭",
			remembered: "该主机最近直连失败",
			cors: "直连失败（通常是 CORS）",
			defaultRoute: "新请求使用 Proxy 路由（路由设置）",
			tunnel: "本地地址只能通过 Tunelo 隧道访问",
		},
		note: "凭据在传输时经过 Localman 服务器（不存储，不记录）",
		noteBody: "代理只转发请求。代理日志只记录主机、状态码和耗时。",
		remember: "不再为 {host} 询问",
		hint: "可在路由设置中更改。若要凭据不离开你的设备，请在目标上启用 CORS。",
		confirm: "经代理发送",
		blockedTitle: "未发送：需要你同意经代理发送",
		blockedBody: "请求带有 {parts}。没有发送任何内容。",
		reopen: "经代理发送…",
	},
	settings: {
		title: "路由",
		loading: "正在加载路由设置…",
		defaultRoute: "新请求的路由",
		defaultHint:
			"Auto 从浏览器直接发送，无法直连时（CORS、fetch 无法设置的请求头、关闭重定向）改走代理。本地地址则使用 Tunelo。Send 旁的选项可按请求覆盖。",
		pinned: {
			title: "始终经代理",
			hint: "Auto 会让这些主机经代理发送，不尝试直连。",
			input: "主机",
			placeholder: "api.example.com",
			add: "添加",
			invalid: "请输入主机名或 IP，可带端口。",
			empty: "还没有主机。",
			remove: "移除 {host}",
		},
		secrets: {
			title: "凭据经代理无需询问",
			hint: "你选择了“不再询问”的主机。",
			empty: "还没有主机。",
			remove: "重新为 {host} 询问",
		},
		cors: {
			title: "最近被拦截（CORS 缓存）",
			hint: "在此浏览器中直连失败的 origin 会在 24 小时内经代理发送。",
			empty: "没有被拦截的 origin。",
			clear: "清除缓存",
			cleared: "已清除 CORS 缓存。",
			forget: "忘记 {origin}",
			until: "至 {time}",
		},
	},
};
