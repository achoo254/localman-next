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
		openApp: "Mở ứng dụng",
		contact: "Liên hệ",
		reset: "Đặt lại",
		retry: "Thử lại",
	},
	opensInNewTab: "(mở ở tab mới)",
	actions: {
		cancel: "Huỷ",
		close: "Đóng",
		delete: "Xoá",
		save: "Lưu",
		send: "Gửi",
		sending: "Đang gửi…",
		processing: "Đang xử lý…",
		copied: "Đã sao chép",
	},
	loading: "Đang tải…",
	optional: "(tuỳ chọn)",
	all: "Tất cả",
	errors: {
		server: "Máy chủ gặp lỗi, thử lại sau.",
		network: "Không kết nối được máy chủ.",
		rateLimited: "Bạn thao tác quá nhanh. Hãy đợi khoảng một phút rồi thử lại.",
		invalidJson: "JSON không hợp lệ.",
		invalidJsonAt: "JSON không hợp lệ ở dòng {line}, cột {column}.",
	},
};
