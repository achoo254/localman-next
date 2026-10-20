import type { Messages } from "../../message-types";

export const legal: Messages["legal"] = {
	effective: "自 {date} 起生效",
	nav: {
		label: "法律文件",
		privacy: "隐私",
		terms: "条款",
		deleteAccount: "删除账号",
	},
	signUpNote:
		"注册即表示你同意<terms>使用条款</terms>和<privacy>隐私政策</privacy>。",
	contact: {
		title: "联系方式",
		body: "关于你的数据或这些条款的问题或请求：发送邮件至 <email>{email}</email>，或使用 Localman 每个页面底部的“反馈 / 联系”（如需回复，请留下联系方式）。",
	},
	pending: {
		title: "更新中",
		body: "以下部分尚未撰写，之后会在此补充：",
		items: {
			operator: "Localman 的运营者（法律主体）",
			minimumAge: "使用 Localman 的最低年龄",
			liability: "责任限制",
			governingLaw: "适用法律与争议解决",
			logRetention: "服务器日志的保留时长",
		},
	},
	accountDelete: {
		title: "删除你的 Localman 账号",
		intro:
			"你可以随时在网页版中自行删除 Localman 账号及其数据。本页说明删除方法以及删除后会发生什么。",
		deleted: "你的 Localman 账号已删除。再次登录会创建一个新的空账号。",
		howTitle: "如何删除",
		how: "- 登录 Localman。\n- 在账号菜单中打开<b>账号与额度</b>。\n- 在<b>删除账号</b>下选择<b>删除账号…</b>，查看将删除的内容，输入你的用户名并确认。",
		openAccount: "前往账号页面",
		whatTitle: "会删除哪些内容",
		what: "- 你拥有的 mock project，以及其中的 resource、数据、request 日志、webhook inbox 和 callback，对你共享过的人同样删除。\n- 你的个人 workspace，以及只有你一个成员的团队 workspace，连同其中的 collection 和 environment。\n- API client 的历史、打开的标签页和设置，通知及通知设置，Web Push 设备，用量计数，与 Tunelo 设备的关联（在 Tunelo 撤销），你登录时通过反馈表单发送的消息，以及所有登录会话。\n- 在还有其他成员的团队 workspace 中，你会退出该 workspace。你在其中写的内容（collection、request、评论、变更记录）属于团队，会被保留，但会移除你的名字。",
		blockedTitle: "需要先处理的情况",
		blocked:
			"如果你是某个团队 workspace 唯一的 Admin，且其中还有其他成员，请先将另一位成员设为 Admin（或移除其他成员）。删除页面会列出这些 workspace。",
		keptTitle: "会保留什么，保留多久",
		kept: "- 数据库每晚备份，并保留最近 14 份，因此已删除的数据最多可能在备份中保留 14 天。\n- 其他人收到的关于你操作的通知会保留发送时的文字，直到过期（90 天）。\n- 你未登录时通过反馈表单发送的消息无法与账号关联；如需删除，请通过表单提出。",
		idpTitle: "你的 {idpName} 登录账号",
		idp: "Localman 不保存你的密码：你使用 {idpName} 账号登录，其他应用也可能使用该账号。删除 Localman 账号不会删除它。如需一并删除，请前往<idpDelete>你的 {idpName} 账号页面</idpDelete>。",
		noAccessTitle: "无需登录，通过邮件申请",
		noAccess:
			"如果无法登录，请发送邮件至 <email>{email}</email> 申请删除账号。请注明你的 Localman 用户名和 {idpName} 账号的邮箱地址，以便找到该账号。你也可以使用本页底部的“反馈 / 联系”。",
	},
};
