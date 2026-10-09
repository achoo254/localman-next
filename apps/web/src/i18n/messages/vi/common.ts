import type { Messages } from "../../message-types";

export const common: Messages["common"] = {
	language: {
		label: "Ngôn ngữ",
		trigger: "Ngôn ngữ: {language}",
		loadFailed:
			"Không tải được ngôn ngữ này. Kiểm tra kết nối mạng rồi thử lại.",
		saveFailed:
			"Không lưu được ngôn ngữ vào tài khoản. Trình duyệt này vẫn dùng ngôn ngữ vừa chọn.",
	},
	cta: {
		startFree: "Bắt đầu miễn phí",
		start: "Bắt đầu",
		contact: "Liên hệ",
		reset: "Đặt lại",
		retry: "Thử lại",
	},
	opensInNewTab: "(mở ở tab mới)",
};
