import type { Messages } from "../../message-types";

export const auth: Messages["auth"] = {
	status: {
		loading: "正在检查登录状态…",
		redirecting: "正在前往登录页…",
		errorTitle: "无法检查登录状态",
		loginLoop:
			"已多次跳转到登录页，但登录状态仍未保留。请检查浏览器是否拦截了 Localman 的 Cookie，然后重试。",
	},
	callbackError: {
		access_denied: {
			title: "你已取消登录",
			text: "Localman 尚未获准访问你的 hoandat 账户。准备好后请重新登录。",
		},
		login_expired: {
			title: "登录已过期",
			text: "登录步骤耗时过长，未能完成。请重新登录。",
		},
		login_failed: {
			title: "登录失败",
			text: "完成登录时出错。请重试。",
		},
		rate_limited: {
			title: "登录尝试次数过多",
			text: "你尝试登录的次数过多，请等待一分钟后重试。",
		},
		idp_unavailable: {
			title: "无法连接 hoandat 账户",
			text: "登录服务器暂无响应。请几分钟后重试。",
		},
	},
	accountFallback: "账户",
};
