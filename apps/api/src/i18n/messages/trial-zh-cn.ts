import { type TrialMessages, dayAsUtc } from "./trial-en.js";

/** Simplified Chinese texts of the Pro trial. */
export const trialZhCN: TrialMessages = {
	/** "2026年10月10日". */
	formatDay: (day) => {
		const date = dayAsUtc(day);
		return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
	},
	endingTitle: (p) => `扩展额度还剩 ${p.daysLeft} 天`,
	endingBody: (p) =>
		`${p.date} 起你的账户将恢复为基础额度。已创建的内容全部保留，但超出该额度时无法再创建。`,
	endedTitle: "扩展额度已结束",
	endedBody: (p) =>
		`自 ${p.date} 起你的账户已恢复为基础额度。所有 project、resource 和数据均保留；超出该额度时无法再创建。`,
	requestedTitle: "Pro 试用延期申请",
	requestedBody: (p) => `${p.user} 申请延长 Pro 试用。请在管理页面批准或拒绝。`,
	approvedTitle: "扩展额度已延长",
	approvedBody: (p) => `你的扩展额度现在可使用至 ${p.date}。`,
	declinedTitle: "申请未获批准",
	declinedBody: "你的申请未获批准。扩展额度保持当前的结束日期。",
	ownerAlert: (p) =>
		[
			"Pro 试用延期申请",
			`用户：${p.user}`,
			`试用结束：${p.date ?? "无结束日期"}`,
			"请在管理页面处理：/admin/trial-extensions",
		].join("\n"),
};
