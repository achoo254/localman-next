import type { Messages } from "../../message-types";

export const admin: Messages["admin"] = {
	heading: "Quản trị · {page}",
	ownerOnly: "Chỉ chủ sở hữu",
	nav: {
		feedback: "Hộp thư góp ý",
	},
	forbidden: {
		title: "403 · Chỉ owner xem được trang này",
		body: "Trang quản trị chỉ dành cho người vận hành Localman.",
		back: "Về Projects",
	},
	pagination: {
		label: "Phân trang",
		previous: "Trang trước",
		next: "Trang sau",
	},
	status: "Trạng thái",
	deletePermanently: "Xoá vĩnh viễn",
	inbox: {
		category: "Loại",
		statuses: { new: "Mới", read: "Đã đọc", resolved: "Đã xử lý" },
		sources: {
			landing: "Trang chủ",
			projects: "Projects",
			apiClient: "API client",
			account: "Tài khoản",
			admin: "Quản trị",
			invite: "Lời mời",
			docs: "Docs",
			elsewhere: "Khác",
		},
		actions: {
			markRead: "Đánh dấu đã đọc",
			markResolved: "Đánh dấu đã xử lý",
			markUnread: "Đánh dấu chưa đọc",
			reopen: "Mở lại",
		},
		user: "Người dùng",
		visitor: "Khách",
		signedIn: "Đã đăng nhập",
		noContact: "Không để lại liên hệ",
		count: { other: "{count} tin" },
		loading: "Đang tải hộp thư…",
		empty: "Không có tin nào khớp bộ lọc.",
		statusChanged: "Đã chuyển sang “{status}”.",
		deleted: "Đã xoá tin.",
		deleteTitle: "Xoá tin",
		deleteQuestion: "Xoá tin của {sender}?",
		deleteBody:
			"Nội dung, tên và địa chỉ liên hệ của tin này bị xoá hẳn. Không hoàn tác được.",
	},
};
