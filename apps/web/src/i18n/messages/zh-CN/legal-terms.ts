import type { Messages } from "../../message-types";

export const legalTerms: Messages["legalTerms"] = {
	title: "使用条款",
	intro:
		"使用 Localman（位于 {appHost} 的网页应用、其 mock API 和 MCP endpoint）即表示你接受这些条款以及<privacy>隐私政策</privacy>。",
	account: {
		title: "你的账号",
		body: "你使用 {idpName} 账号登录；Localman 不保存密码。请保护好该账号：任何用它登录的人都能使用你的 Localman 数据，你通过它授权的 AI agent 也以你的权限操作。",
	},
	limits: {
		title: "额度",
		body: "Localman 目前免费使用。你的额度和本月用量显示在账号页面；账号可能在一段时间内享有扩展额度，页面会显示截止时间。扩展额度结束后不会删除任何内容，只会拒绝超出额度的新内容。额度可能会调整。",
	},
	content: {
		title: "你的内容",
		body: "你对自己创建的内容保留全部权利。你允许 Localman 仅为运行你使用的功能而存储和处理这些内容，具体见隐私政策。",
	},
	sharing: {
		title: "你分享的内容",
		body: "- 任何知道某个 project mock URL 的人都能调用其 mock API，包括你已移除的成员。可在 project 中更换 URL 以阻止旧链接。\n- 任何持有 collection 公开链接的人都能读取它；secret 变量的值会被去除。\n- 你邀请到 project 或 workspace 的人会按其角色查看和修改内容。",
	},
	use: {
		title: "合理使用",
		body: "Localman 设有频率限制和每月额度，并拒绝向内网和邮件端口发送 request。请勿尝试绕过这些限制、使服务过载，或利用它攻击或访问你无权访问的系统。",
	},
	cleanup: {
		title: "不活跃和已删除的数据",
		body: "账号处于标准额度时，90 天无活动的 project 可能会被删除。已删除的 collection 会在回收站保留 30 天，之后永久删除。request 日志和历史按隐私政策所述过期。",
	},
	service: {
		title: "服务",
		body: "Localman 可能变更、中断或停止，功能也可能被关闭。",
	},
	end: {
		title: "终止",
		body: "你可以随时<accountDelete>删除你的 Localman 账号</accountDelete>。违反这些条款的账号可能会被封禁。",
	},
	changes: {
		title: "变更",
		body: "这些条款变更时，页面顶部的日期会随之更新。",
	},
};
