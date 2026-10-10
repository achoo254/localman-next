import type { ServerMessages } from "./en.js";

const monthName = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "long",
	timeZone: "UTC",
});

/** Simplified Chinese server texts; technical terms stay in English. */
export const zhCN: ServerMessages = {
	/** e.g. "2026年10月". */
	formatMonth: (year, month) =>
		monthName.format(new Date(Date.UTC(year, month - 1, 1))),
	eventLabels: {
		"project.invitation": "Project 协作邀请",
		"project.mockUrlChanged": "共享 project 的 mock URL 已更改",
		"usage.quota": "每月 mock request 额度提醒",
	},
	invitation: {
		title: "Project 协作邀请",
		body: (p) =>
			`${p.inviter === null ? "Project 所有者" : `${p.inviter} `}邀请你参与 project“${p.project}”的协作。邀请将在 ${p.days} 天后过期。`,
	},
	mockUrlChanged: {
		title: "Mock URL 已更改",
		body: (p) =>
			`Project 所有者更改了 project“${p.project}”的 mock URL。旧 URL 已失效，请使用 project 页面中的新 URL。`,
	},
	quota: {
		usedUpTitle: "本月 mock API request 次数已用完",
		usedUpBody: (p) =>
			`你的 project 已用完 ${p.month}的全部 ${p.limit} 次 mock API request。在下月初或升级到 Pro 之前，mock API 将返回 429。`,
		warningTitle: (p) => `本月 mock API request 次数已使用 ${p.threshold}%`,
		warningBody: (p) =>
			`你的 project 已使用 ${p.month}的 ${p.used}/${p.limit} 次 mock API request。`,
	},
	testNotification: {
		title: "测试通知",
		body: "看到这条消息，说明 Localman 的通知可以通过此渠道送达。",
	},
	apiClient: {
		proxyBusyUser: (p) =>
			`你已有 ${p.max} 个 request 正在通过 proxy 发送，请等其中一个完成后再试。`,
		proxyBusyServer: "Proxy 正忙于处理其他 request，请稍后再试。",
		tunnelUrlInvalid: (p) =>
			`tunnel URL 必须是 https://<名称>.<domain>，不能带端口、路径或查询参数，且 domain 须为以下之一：${p.domains}。`,
		tunnelsDisabled: "此服务器未启用 tunnel URL。",
	},
	ownerAlerts: {
		suppressed: (count) => `（另有 ${count} 条因超出提醒上限未发送）`,
		contactCategories: {
			feedback: "反馈",
			bug: "错误报告",
			plan_question: "套餐咨询",
		},
		contact: (p) =>
			[
				`新的反馈 / 联系：${p.category}`,
				`内容：${p.excerpt}`,
				`联系方式：${p.contact ?? "未留下"}`,
				`发送者：${p.signedIn ? "已登录" : "访客"}`,
				`来源：${p.source}`,
			].join("\n"),
		proInterestHeadlines: {
			created: "Pro 套餐意向：新登记",
			updated: "Pro 套餐意向：已更新",
			recorded: "Pro 套餐意向：他人再次提交（仅记录历史）",
		},
		proInterest: (p) =>
			[
				p.headline,
				`邮箱：${p.email}`,
				`需求：${p.needs}`,
				`团队规模：${p.teamSize}`,
				`来源：${p.source}`,
			].join("\n"),
	},
};
