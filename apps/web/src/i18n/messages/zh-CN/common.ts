import type { Messages } from "../../message-types";

export const common: Messages["common"] = {
	language: {
		label: "语言",
		trigger: "语言：{language}",
		loadFailed: "无法加载该语言。请检查网络连接后重试。",
		saveFailed: "未能将语言保存到账户。当前浏览器仍会使用所选语言。",
	},
	cta: {
		startFree: "免费开始",
		start: "开始",
		contact: "联系我们",
		reset: "重置",
		retry: "重试",
	},
	opensInNewTab: "（在新标签页中打开）",
};
