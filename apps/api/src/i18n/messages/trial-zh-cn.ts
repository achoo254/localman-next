import { type TrialMessages, dayAsUtc } from "./trial-en.js";

/** Simplified Chinese texts of the Pro trial. */
export const trialZhCN: TrialMessages = {
	/** "2026年10月10日". */
	formatDay: (day) => {
		const date = dayAsUtc(day);
		return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
	},
	endingTitle: (p) => `Pro 试用还剩 ${p.daysLeft} 天`,
	endingBody: (p) =>
		`你的 Pro 试用将于 ${p.date} 结束。之后账户恢复为 Free：已创建的内容全部保留，但超出 Free 限额时无法再创建。你可以在账户页面申请延期。`,
	endedTitle: "Pro 试用已结束",
	endedBody: (p) =>
		`你的 Pro 试用已于 ${p.date} 结束，账户已恢复为 Free。所有 project、resource 和数据均保留；超出 Free 限额时无法再创建。你可以在 7 天内于账户页面申请延期。`,
	requestedTitle: "Pro 试用延期申请",
	requestedBody: (p) => `${p.user} 申请延长 Pro 试用。请在管理页面批准或拒绝。`,
	approvedTitle: "Pro 试用已延期",
	approvedBody: (p) => `你的 Pro 试用现在可使用至 ${p.date}。`,
	declinedTitle: "Pro 试用延期申请被拒绝",
	declinedBody: "你的 Pro 试用延期申请已被拒绝。试用保持当前的结束日期。",
	ownerAlert: (p) =>
		[
			"Pro 试用延期申请",
			`用户：${p.user}`,
			`试用结束：${p.date ?? "无结束日期"}`,
			"请在管理页面处理：/admin/trial-extensions",
		].join("\n"),
};
