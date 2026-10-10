import type { Messages } from "../../message-types";

export const layout: Messages["layout"] = {
	skipLink: "跳到主要内容",
	pageLoading: "正在加载页面…",
	docs: "文档",
	projects: "Projects",
	publicHeader: {
		home: "Localman，返回首页",
		nav: "主导航",
		features: "功能",
		pricing: "价格",
		signIn: "登录",
	},
	appHeader: {
		home: "Localman，返回 Projects",
	},
	plan: {
		free: "Free 套餐",
		pro: "Pro 套餐",
	},
	accountMenu: {
		trigger: "{name} · 账号",
		account: "账号与额度",
		plan: "管理套餐",
		notifications: "通知渠道",
		adminProInterest: "管理 · Pro 意向",
		adminFeedback: "管理 · 反馈收件箱",
		signOut: "退出登录",
	},
	idpMenu: {
		heading: "hoandat 账号 · 在新标签页中打开",
		email: "邮箱",
		signIn: "登录方式",
		apps: "已授权的应用",
		opensIdp: "，在新标签页中打开 hoandat 账号",
	},
	footer: {
		copyright: "© {year} Localman",
		feedback: "反馈 / 联系",
	},
	theme: {
		legend: "颜色模式",
		light: "浅色主题",
		dark: "深色主题",
		system: "跟随系统",
	},
};
