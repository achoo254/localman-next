import type { Messages } from "../../message-types";

export const apiClientTunelo: Messages["apiClientTunelo"] = {
	rail: "Tunelo",
	title: "Tunelo",
	intro:
		"在浏览器中测试 localhost 上的 API：用一条 Tunelo 命令将其公开，然后在这里把本地地址映射到隧道 URL。",
	steps: {
		label: "打开隧道",
		install: "安装 Tunelo（需要 Node 20+）",
		login: "登录此设备",
		http: "为端口 {port} 打开隧道",
		tcpHint:
			"API 客户端只能发送 HTTP。TCP 服务可使用 <code>tunelo tcp {port}</code>。",
	},
	warning: {
		title: "隧道会把本地服务暴露到互联网",
		body: "隧道运行期间，任何拿到 URL 的人都能调用你设备上的应用。敏感数据请加 <code>-a user:pass</code>，测试结束后按 Ctrl+C 停止隧道。",
	},
	form: {
		title: "映射本地地址",
		local: "本地地址",
		localPlaceholder: "http://localhost:3000",
		tunnel: "隧道 URL",
		tunnelPlaceholder: "https://name.{domain}",
		add: "保存映射",
		invalidLocal: "请输入你设备或网络上的地址，例如 http://localhost:3000。",
		invalidTunnel:
			"请粘贴 Tunelo 输出的 https URL，例如 https://name.{domain}。",
		noDomains: "此服务器尚未配置隧道域名，因此无法保存隧道 URL。",
		saved: "发往 {key} 的请求现在经隧道发送。",
	},
	mappings: {
		title: "映射",
		hint: "发往已映射本地地址的请求会经其隧道发送，路径和查询参数保持不变。只有你能看到自己的映射。",
		empty: "还没有映射。",
		loading: "正在加载映射…",
		use: "为 {key} 使用隧道",
		delete: "删除 {key} 的映射",
	},
	panel: {
		title: "通过 Tunelo 发送到你的设备",
		reason: "代理无法访问 {key}",
		reasonBody:
			"Localman 代理运行在服务器上，因此拒绝 localhost 和局域网地址。请用 Tunelo 打开隧道，并在下方粘贴其 URL。",
		directFailed: "已尝试直接发送到 {key}",
		directFailedBody:
			"浏览器拒绝了：开发服务器没有为此页面返回 CORS，或本地网络访问被拒绝。",
		recheck: "重新发送",
		paste: "或粘贴隧道 URL",
		pasteSubmit: "替换主机并重新发送",
	},
	cors: {
		title: "或在开发服务器上启用 CORS",
		body: "在开发服务器上允许 {origin} 即可直接发送：凭据不会离开你的设备。",
		framework: "框架",
	},
	badge: {
		label: "经 Tunelo",
		tip: "发送到 {url}",
		unmap: "移除 {key} 的映射",
	},
};
