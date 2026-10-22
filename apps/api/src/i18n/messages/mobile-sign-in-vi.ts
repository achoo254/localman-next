import type { MobileSignInMessages } from "./mobile-sign-in-en.js";

/** Vietnamese texts of the native app sign-in pages. */
export const mobileSignInVi: MobileSignInMessages = {
	confirmTitle: (p) => `Đăng nhập app ${p.app}`,
	confirmBody: (p) =>
		`Mở app ${p.app} trên điện thoại này với tài khoản ${p.account}?`,
	confirmHint:
		"Chỉ bấm Tiếp tục nếu chính bạn vừa bắt đầu đăng nhập từ app trên máy này.",
	continue: "Tiếp tục",
	cancel: "Huỷ",
	expiredTitle: "Lượt đăng nhập này đã hết hạn",
	expiredBody: "Quay lại app và đăng nhập lại từ đầu.",
	callbackTitle: (p) => `Quay lại app ${p.app}`,
	callbackBody:
		"Nếu app không tự mở, hãy bấm nút bên dưới. Nếu máy chưa cài app, hãy cài trước rồi đăng nhập từ app.",
	callbackError: "Đăng nhập chưa xong. Quay lại app và thử lại.",
	openApp: (p) => `Mở ${p.app}`,
};
