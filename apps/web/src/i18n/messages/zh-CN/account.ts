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
};
