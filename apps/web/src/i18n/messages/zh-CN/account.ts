import type { Messages } from "../../message-types";

export const account: Messages["account"] = {
	title: "账号",
	limitsUntil: "你的扩展额度有效期至 {date}。",
	notificationChannels: "通知渠道",
	usage: {
		loading: "正在加载额度…",
		loadFailed: "无法加载额度",
	},
	meters: {
		projects: "Projects",
		projectsNote: "只统计你拥有的 project，不含受邀加入的 project。",
		mockRequests: "本月 mock request",
		mockNote: "统计所有发往 mock 的 REST request。{date} 重置。",
		mockNoteMcp: "REST 和 MCP 都计入。{date} 重置。",
		proxyRequests: "本月 proxy request",
		proxyNote:
			"从 API client 发出的 request，包括经由 Tunelo 的 request。{date} 重置。",
	},
	delete: {
		title: "删除账号",
		body: "永久删除你的 Localman 账号及其数据。你的 {idpName} 登录账号不受影响。",
		learnMore: "会删除哪些内容",
		open: "删除账号…",
		question: "删除你的 Localman 账号？",
		loading: "正在检查将删除的内容…",
		loadFailed: "无法检查将删除的内容",
		projects: {
			other: "你拥有的 {count} 个 mock project 及其数据",
		},
		sharedProjects: {
			other: "其中 {count} 个已共享：其成员也会失去访问权限",
		},
		workspaces: {
			other: "{count} 个 workspace：你的个人 workspace，以及没有其他成员的团队",
		},
		collections: {
			other: "其中的 {count} 个 collection 及其 request",
		},
		leftWorkspaces: {
			other:
				"你将退出 {count} 个团队 workspace；你在其中写的内容会保留，但不再显示你的名字",
		},
		everythingElse:
			"历史、打开的标签页、设置、通知以及所有登录会话也会被删除。",
		irreversible: "此操作无法撤销。",
		blocked:
			"你是以下团队 workspace 唯一的 Admin，且其中还有其他成员。请先将另一位成员设为 Admin，或移除其他成员，然后重试：",
		idp: "你的 {idpName} 账号会保留。如需删除，请<idpDelete>在 {idpName} 删除它</idpDelete>。",
		confirmLabel: "输入你的用户名 <b>{username}</b> 以确认",
		confirm: "删除账号",
	},
};
