import type { Messages } from "../../message-types";

export const layout: Messages["layout"] = {
	skipLink: "Bỏ qua tới nội dung",
	pageLoading: "Đang tải trang…",
	docs: "Docs",
	projects: "Projects",
	home: "Trang chủ Localman",
	publicHeader: {
		home: "Localman, về trang chủ",
		nav: "Điều hướng chính",
		features: "Tính năng",
		signIn: "Đăng nhập",
	},
	appHeader: {
		home: "Localman, về Projects",
		nav: "Sản phẩm",
		mocks: "Mock API",
	},
	accountMenu: {
		trigger: "{name} · Tài khoản",
		account: "Tài khoản và hạn mức",
		notifications: "Kênh thông báo",
		adminProInterest: "Quản trị · Quan tâm gói Pro",
		adminFeedback: "Quản trị · Hộp thư góp ý",
		signOut: "Đăng xuất",
	},
	idpMenu: {
		heading: "Tài khoản hoandat · mở tab mới",
		email: "Email",
		signIn: "Phương thức đăng nhập",
		apps: "Ứng dụng đã cấp quyền",
		opensIdp: ", mở trang tài khoản hoandat ở tab mới",
	},
	footer: {
		copyright: "© {year} Localman",
		feedback: "Góp ý / Liên hệ",
	},
	theme: {
		legend: "Chế độ màu",
		light: "Giao diện sáng",
		dark: "Giao diện tối",
		system: "Theo hệ thống",
	},
};
