import type { Messages } from "../../message-types";

export const feedback: Messages["feedback"] = {
	title: "Góp ý / Liên hệ",
	categories: {
		feedback: {
			label: "Góp ý",
			placeholder: "Bạn muốn Localman làm tốt hơn điều gì?",
		},
		bug: {
			label: "Báo lỗi",
			placeholder: "Bạn đang làm gì thì gặp lỗi, và lỗi hiện ra thế nào?",
		},
		planQuestion: {
			label: "Hỏi về gói",
			placeholder: "Bạn cần hạn mức hay tính năng nào?",
		},
	},
	fields: {
		kind: "Loại",
		message: "Nội dung",
		length: "{length}/{max} ký tự",
		name: "Tên",
		contact: "Email hoặc Telegram",
		contactPlaceholder: "ban@example.com hoặc @username",
		contactHint: "Để lại nếu bạn muốn được trả lời.",
		fromAccount: "Lấy từ tài khoản của bạn.",
		honeypot: "Không điền ô này",
	},
	errors: {
		messageRequired: "Nhập nội dung.",
		messageTooLong: "Nhập nội dung, tối đa {max} ký tự.",
		nameTooLong: "Tên tối đa {max} ký tự.",
		contactInvalid: "Nhập email hoặc username Telegram hợp lệ, hoặc để trống.",
		turnstile: "Hoàn tất xác minh trước khi gửi.",
	},
	submit: {
		rateLimited:
			"Bạn gửi nhiều lần liên tiếp. Đợi vài phút rồi thử lại. Nội dung vẫn còn đây.",
		validation:
			"Thông tin chưa hợp lệ, kiểm tra lại các ô rồi gửi lại. Nội dung vẫn còn đây.",
		turnstileFailed:
			"Xác minh không thành công, làm lại bước xác minh. Nội dung vẫn còn đây.",
		turnstileUnavailable:
			"Chưa kiểm tra được bước xác minh lúc này, thử lại sau ít phút. Nội dung vẫn còn đây.",
		failed: "Chưa gửi được. Nội dung vẫn còn đây, hãy thử lại.",
		sessionLost:
			"Phiên đăng nhập đã hết hạn. Hoàn tất bước xác minh rồi gửi lại. Nội dung vẫn còn đây.",
	},
	openFailed: "Không mở được form",
	preparing: "Đang chuẩn bị bước xác minh…",
	noteSignedIn:
		"Góp ý gửi kèm tài khoản của bạn và khu vực bạn đang mở (ví dụ Projects), không kèm đường dẫn.",
	noteVisitor:
		"Góp ý gửi kèm khu vực bạn đang mở (ví dụ trang chủ), không kèm đường dẫn.",
	sent: {
		title: "Đã gửi, cảm ơn bạn",
		body: "Chúng tôi đã nhận được tin của bạn.",
		reply: "Chúng tôi sẽ trả lời qua {contact} nếu cần.",
	},
};
