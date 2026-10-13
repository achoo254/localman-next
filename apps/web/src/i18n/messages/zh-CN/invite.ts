import type { Messages } from "../../message-types";

export const invite: Messages["invite"] = {
	pageTitle: "Project 邀请",
	signIn: {
		title: "你受邀加入 Localman 上的一个 project",
		text: "登录或创建 {idpName} 账号即可查看邀请，完成后会回到此页面。",
		signIn: "登录",
		signUp: "注册",
	},
	loading: "正在检查邀请…",
	failedTitle: "无法打开邀请",
	backToProjects: "返回 Projects",
	toast: {
		joined: "已加入 {project}",
		alreadyMember: "你已经是 {project} 的成员",
	},
	invalid: {
		expiredTitle: "邀请链接已过期",
		expiredText: "链接已于 {date} 过期。请让邀请人发送新链接。",
		expiredTextNoDate: "请让邀请人发送新链接。",
		usedTitle: "邀请链接已被使用",
		usedText: "每个邀请链接只能使用一次。请让邀请人发送新链接。",
		revokedTitle: "邀请链接已失效",
		revokedText: "Project 所有者已撤销此链接，或链接不正确。",
	},
	preview: {
		title: "加入 {project}",
		inviter: "{inviter} 邀请你协作。",
		expiresShared: "共享链接 · {date} 过期",
		expires: "{date} 过期",
		signedInAs: "你当前登录的账号是 <b>{account}</b>",
		alreadyMember: "你已经是 {project} 的成员。",
		openProject: "打开 project",
		full: "此 project 的成员名额已满。请让 project 所有者移除部分成员。",
		removed:
			"Project 所有者已将你移出此 project。如需重新加入，请联系 project 所有者。",
		ineligibleTitle: "此账号无法接受邀请",
		ineligibleOther: "此邀请发给了另一个账号。请使用受邀账号登录。",
		ineligibleUnverified:
			"邀请发给了 {email}。此账号的邮箱尚未验证：请使用邮箱已验证且与之相同的 Google/GitHub 登录。",
		ineligibleWrongAccount:
			"邀请发给了 {email}。请使用受邀账号登录，或关联邮箱已验证且与之相同的 Google/GitHub。",
		accept: "加入",
	},
	switchAccount: {
		action: "登录其他账号",
		hint: "你将被退出登录。请用受邀账号重新登录，然后再次打开此链接。",
	},
	errors: {
		rateLimited: "你打开的邀请链接过多，请几分钟后重试。",
		conflict: "邀请刚刚发生变化，请重试。",
		fallback: "无法打开邀请，请稍后重试。",
	},
};
