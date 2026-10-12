import type { Messages } from "../../message-types";

export const feedback: Messages["feedback"] = {
	title: "反馈 / 联系我们",
	categories: {
		feedback: {
			label: "反馈",
			placeholder: "你希望 Localman 在哪方面做得更好？",
		},
		bug: {
			label: "报告问题",
			placeholder: "出错时你在做什么？问题是怎样表现的？",
		},
		planQuestion: {
			label: "额度咨询",
			placeholder: "你需要哪些额度或功能？",
		},
	},
	fields: {
		kind: "类型",
		message: "内容",
		length: "{length}/{max} 个字符",
		name: "姓名",
		contact: "邮箱或 Telegram",
		contactPlaceholder: "you@example.com 或 @username",
		contactHint: "如果希望收到回复，请留下联系方式。",
		fromAccount: "取自你的账号。",
		honeypot: "请勿填写此项",
	},
	errors: {
		messageRequired: "请输入内容。",
		messageTooLong: "内容最多 {max} 个字符。",
		nameTooLong: "姓名最多 {max} 个字符。",
		contactInvalid: "请输入有效的邮箱或 Telegram 用户名，或留空。",
		turnstile: "发送前请完成验证。",
	},
	submit: {
		rateLimited: "你连续发送的次数过多。请等几分钟后重试。内容仍保留在这里。",
		validation: "部分信息无效，请检查后重新发送。内容仍保留在这里。",
		turnstileFailed: "验证未通过，请重新完成验证。内容仍保留在这里。",
		turnstileUnavailable:
			"暂时无法完成验证检查，请几分钟后重试。内容仍保留在这里。",
		failed: "未能发送。内容仍保留在这里，请重试。",
		sessionLost: "登录会话已过期。请完成验证后重新发送。内容仍保留在这里。",
	},
	openFailed: "无法打开表单",
	preparing: "正在准备验证…",
	turnstileLoadFailed: "无法加载验证步骤。请检查网络连接，然后重新打开表单。",
	noteSignedIn:
		"反馈会附带你的账号和当前所在区域（例如 Projects），不包含页面地址。",
	noteVisitor: "反馈会附带你当前所在区域（例如首页），不包含页面地址。",
	sent: {
		title: "已发送，谢谢",
		body: "我们已收到你的消息。",
		reply: "如有需要，我们会通过 {contact} 回复你。",
	},
};
