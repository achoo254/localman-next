import type { Messages } from "../../message-types";

export const common: Messages["common"] = {
	language: {
		label: "语言",
		trigger: "语言：{language}",
		loadFailed: "无法加载该语言。请检查网络连接后重试。",
		saveFailed: "未能将语言保存到账号。当前浏览器仍会使用所选语言。",
	},
	cta: {
		startNow: "立即开始",
		start: "开始",
		openApp: "打开应用",
		reset: "重置",
		retry: "重试",
	},
	opensInNewTab: "（在新标签页中打开）",
	actions: {
		cancel: "取消",
		close: "关闭",
		delete: "删除",
		save: "保存",
		send: "发送",
		sending: "正在发送…",
		copied: "已复制",
	},
	loading: "正在加载…",
	optional: "（可选）",
	all: "全部",
	errors: {
		server: "服务器出错，请稍后重试。",
		network: "无法连接服务器。",
		rateLimited: "你的操作太快了，请等待约一分钟后重试。",
		invalidJson: "JSON 无效。",
		invalidJsonAt: "JSON 无效：第 {line} 行，第 {column} 列。",
	},
};
