import type { ServerMessages } from "./en.js";
import { trialZhCN } from "./trial-zh-cn.js";

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
		"trial.ending": "扩展额度即将结束",
		"trial.ended": "扩展额度已结束",
		"trial.extension.requested": "Pro 试用延期申请（所有者）",
		"trial.extension.approved": "扩展额度已延长",
		"trial.extension.declined": "扩展额度未获延长",
		"workspace.invitation": "Workspace 邀请",
		"element.shared": "与你共享的 collection 和 environment",
		"access.requested": "对你的 collection 和 environment 的访问请求",
		"access.resolved": "你的访问请求的处理结果",
		"comment.mentioned": "评论中提到你",
		"comment.replied": "你参与的评论讨论有新回复",
		"collection.changed": "你关注的 collection 有变更",
		"pullRequest.opened": "等待你审核的 pull request",
		"pullRequest.reviewed": "你的 pull request 的审核结果",
		"pullRequest.merged": "你的 pull request 已合并",
	},
	roleNames: { admin: "Admin", editor: "Editor", viewer: "Viewer" },
	elementNames: { collection: "collection", environment: "environment" },
	workspaceInvitation: {
		title: "Workspace 邀请",
		body: (p) =>
			`${p.inviter === null ? "Workspace Admin" : p.inviter}邀请你以 ${p.role} 身份加入 workspace“${p.workspace}”。邀请将在 ${p.days} 天后过期。`,
	},
	elementShared: {
		title: "与你共享",
		body: (p) =>
			`${p.sharer ?? "有人"}以 ${p.role} 身份与你共享了 ${p.kind}“${p.element}”。`,
	},
	accessRequested: {
		title: "访问请求",
		body: (p) =>
			`${p.requester} 请求 ${p.kind}“${p.element}”的 ${p.role} 权限。`,
	},
	accessResolved: {
		approvedTitle: "访问请求已批准",
		approvedBody: (p) =>
			`你现在拥有 ${p.kind}“${p.element}”的 ${p.role} 权限。`,
		deniedTitle: "访问请求被拒绝",
		deniedBody: (p) =>
			`你对 ${p.kind}“${p.element}”的 ${p.role} 权限请求已被拒绝。`,
	},
	commentMentioned: {
		title: "有人在评论中提到你",
		body: (p) =>
			`${p.author ?? "有人"}在 collection“${p.collection}”${p.item === null ? "" : `的“${p.item}”`}的评论中提到了你。`,
	},
	commentReplied: {
		title: "新回复",
		body: (p) =>
			`${p.author ?? "有人"}回复了 collection“${p.collection}”${p.item === null ? "" : `中“${p.item}”`}的评论讨论。`,
	},
	collectionChanged: {
		title: "Collection 有变更",
		body: (p) =>
			p.authors === 1
				? `${p.author ?? "有人"}对 collection“${p.collection}”做了 ${p.changes} 处变更。`
				: `${p.authors} 人对 collection“${p.collection}”做了 ${p.changes} 处变更。`,
	},
	pullRequestOpened: {
		title: "请求审核",
		body: (p) =>
			`${p.author ?? "有人"}请你审核合并到 collection“${p.collection}”的 pull request“${p.title}”。`,
	},
	pullRequestReviewed: {
		approvedTitle: "Pull request 已批准",
		approvedBody: (p) =>
			`${p.author ?? "审核人"}批准了你合并到 collection“${p.collection}”的 pull request“${p.title}”。`,
		declinedTitle: "Pull request 被拒绝",
		declinedBody: (p) =>
			`${p.author ?? "审核人"}拒绝了你合并到 collection“${p.collection}”的 pull request“${p.title}”。`,
	},
	pullRequestMerged: {
		title: "Pull request 已合并",
		body: (p) =>
			`${p.author ?? "有人"}合并了你到 collection“${p.collection}”的 pull request“${p.title}”。`,
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
			`你的 project 已用完 ${p.month}的全部 ${p.limit} 次 mock API request。在下月初之前，mock API 将返回 429。`,
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
	traffic: {
		tunnelMissing: (p) =>
			`项目所有者的 API client 设置中没有映射到 localhost:${p.port} 的 tunnel。请运行 "tunelo http ${p.port}"，并把它的 URL 设为 localhost:${p.port} 的 tunnel。`,
		tunnelDown: (p) =>
			`到 localhost:${p.port} 的 tunnel 没有响应。请确认 "tunelo http ${p.port}" 和本地服务器仍在运行。`,
		unreachable: "upstream 没有响应（连接失败或超时）。",
		blocked: "upstream 解析到私有、回环或链路本地地址，不会被访问。",
		responseTooLarge: (p) => `upstream 的 response 超过 ${p.mb} MB。`,
		busy: "等待此项目 upstream 的 request 过多，请稍后再试。",
		loop: "request 从 upstream 又回到了 Localman 的 mock，请检查项目的 upstream 设置。",
		baseUrlInvalid:
			"upstream URL 必须是 https://host[:port][/path]，不能带登录信息、查询参数或片段，也不能是 Localman 的 mock URL。",
		baseUrlBlocked:
			"upstream URL 解析到私有、回环或链路本地地址；请改用 Tunelo tunnel 暴露本地服务器。",
		baseUrlDns: "无法解析 upstream 的主机名。",
		replayBodyTruncated:
			"此 request 的 body 在日志中被截断为 64 KB，无法原样重放。",
		replayFailed: "重放的 request 没有收到 mock 的响应。",
		streamLimit: (p) =>
			`你已打开 ${p.max} 个实时 request 日志，请关闭一个后再试。`,
		callbackUrlInvalid:
			"callback URL 必须是 https://…，不能包含凭据或 fragment，也不能是 Localman 的 mock URL。要发到你的电脑，请使用 tunnel:<port><path>。",
		callbackUrlBlocked:
			"该地址指向私有网络，Localman 无法向其发送 callback。请改用 Tunelo tunnel 暴露本地服务器。",
		callbackDns: "无法解析 callback 的主机名。",
	},
	trial: trialZhCN,
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
