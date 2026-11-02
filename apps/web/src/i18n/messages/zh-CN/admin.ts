import type { Messages } from "../../message-types";

export const admin: Messages["admin"] = {
	heading: "管理 · {page}",
	ownerOnly: "仅限所有者",
	nav: {
		feedback: "反馈收件箱",
	},
	forbidden: {
		title: "403 · 只有所有者可以查看此页面",
		body: "管理页面仅供 Localman 运营人员使用。",
		back: "返回 Projects",
	},
	pagination: {
		label: "分页",
		previous: "上一页",
		next: "下一页",
	},
	status: "状态",
	deletePermanently: "永久删除",
	inbox: {
		category: "类型",
		statuses: { new: "新", read: "已读", resolved: "已处理" },
		sources: {
			landing: "首页",
			projects: "Projects",
			apiClient: "API client",
			account: "账号",
			admin: "管理",
			invite: "邀请",
			docs: "文档",
			elsewhere: "其他",
		},
		actions: {
			markRead: "标记为已读",
			markResolved: "标记为已处理",
			markUnread: "标记为未读",
			reopen: "重新打开",
		},
		user: "用户",
		visitor: "访客",
		signedIn: "已登录",
		noContact: "未留联系方式",
		count: { other: "{count} 条消息" },
		loading: "正在加载收件箱…",
		empty: "没有符合筛选条件的消息。",
		statusChanged: "已改为“{status}”。",
		deleted: "已删除消息。",
		deleteTitle: "删除消息",
		deleteQuestion: "删除来自 {sender} 的消息？",
		deleteBody: "该消息的内容、姓名和联系方式将被彻底删除，无法撤销。",
	},
};
