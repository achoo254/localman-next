import type { MobileSignInMessages } from "./mobile-sign-in-en.js";

/** Simplified Chinese texts of the native app sign-in pages. */
export const mobileSignInZhCN: MobileSignInMessages = {
	confirmTitle: (p) => `登录 ${p.app} 应用`,
	confirmBody: (p) =>
		`要在这台手机上以 ${p.account} 的身份打开 ${p.app} 应用吗？`,
	confirmHint: "只有当你刚刚在这台设备的应用中发起登录时，才继续。",
	continue: "继续",
	cancel: "取消",
	expiredTitle: "此次登录已过期",
	expiredBody: "请回到应用，重新开始登录。",
	callbackTitle: (p) => `返回 ${p.app} 应用`,
	callbackBody:
		"如果应用没有自动打开，请点击下方按钮。若尚未安装应用，请先安装，再从应用中登录。",
	callbackError: "登录未完成。请回到应用重试。",
	openApp: (p) => `打开 ${p.app}`,
};
