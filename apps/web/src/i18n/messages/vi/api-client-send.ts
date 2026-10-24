import type { Messages } from "../../message-types";

export const apiClientSend: Messages["apiClient"]["send"] = {
	preScriptFailed: "Chưa gửi: script pre-request đã dừng. {reason}",
	secretWithheld:
		"Chưa gửi: request dùng {name}, một secret chỉ Editor xem được. Hãy đặt giá trị local của riêng bạn cho biến này trong environment rồi gửi lại.",
	scopesDropped:
		"Script đã đặt giá trị {scopes} nhưng không có chỗ lưu: chưa có environment đang active, hoặc request không thuộc collection nào.",
	scopeNames: { environment: "environment", collectionVariables: "collection" },
	scopesNotSaved:
		"Đã nhận response, nhưng không lưu được các biến mà script đã đặt. Hãy gửi lại để thử lại.",
	dynamicVariablesUnavailable:
		"Chưa gửi: không tải được giá trị ngẫu nhiên ($random…). Kiểm tra kết nối rồi thử lại.",
	variablesUnavailable:
		"Chưa gửi: không tải được biến của environment. Hãy kiểm tra kết nối rồi thử lại.",
	sourceFailed:
		"Chưa gửi: request mà request này cần response không nhận được response.",
	references: {
		REFERENCE_OUTSIDE_COLLECTION:
			"Chưa gửi: tham chiếu response chỉ dùng được trong request đã lưu vào collection.",
		REFERENCE_REQUEST_NOT_FOUND:
			"Chưa gửi: collection này không có request tên “{name}” cho tham chiếu response.",
		REFERENCE_LOOP:
			"Chưa gửi: “{name}” cần response của chính request đang gửi, tạo thành vòng lặp.",
		REFERENCE_TOO_DEEP:
			"Chưa gửi: tham chiếu response nối qua quá nhiều request (tối đa 5).",
		REFERENCE_SEND_FAILED:
			"Chưa gửi: request {name} mà tham chiếu response cần không nhận được response.",
		REFERENCE_NOT_JSON:
			"Chưa gửi: response của “{name}” không phải JSON nên không đọc được {path}.",
		REFERENCE_PATH_INVALID:
			"Chưa gửi: {path} không phải JSONPath dạng $.token hay $.items[0].id.",
		REFERENCE_PATH_MISSING:
			"Chưa gửi: response của “{name}” không có gì ở {path}.",
	},
	fileUnreadable: "Không đọc được một file của body. Hãy chọn lại file.",
	prepare: {
		invalidUrl:
			"Hãy nhập URL http hoặc https đầy đủ, ví dụ https://api.example.com/users.",
		invalidHeaderName:
			"Header “{name}” có ký tự không được phép trong tên header.",
		invalidHeaderValue: "Giá trị của header “{name}” có ký tự xuống dòng.",
		fileMissing:
			"Hãy chọn lại file “{name}”: file không được giữ lại sau khi tải lại trang.",
		bodyTooLarge: "Body lớn hơn 10 MB, mức tối đa một request mang được.",
	},
	script: {
		SCRIPT_ERROR: "Script báo lỗi.",
		SCRIPT_TOO_LONG: "Script quá dài.",
		SCRIPT_TIMEOUT: "Script chạy quá lâu nên đã bị dừng.",
		SCRIPT_MEMORY_LIMIT: "Script dùng quá nhiều bộ nhớ.",
		SCRIPT_STACK_OVERFLOW: "Script gọi lồng nhau quá sâu.",
		SCRIPT_UNAVAILABLE:
			"Không tải được sandbox chạy script. Hãy kiểm tra kết nối rồi thử lại.",
		SCRIPT_INTERNAL: "Sandbox chạy script gặp lỗi. Hãy thử lại.",
		atLine: "{reason} (dòng {line})",
	},
};
