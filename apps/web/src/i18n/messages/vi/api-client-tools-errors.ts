import type { Messages } from "../../message-types";

export const apiClientToolsErrors: Messages["apiClientTools"]["errors"] = {
	code: "Mã: {code}",
	unknown: {
		title: "Không gửi được request",
		hint: "{message}",
	},
	targetBlocked: {
		title: "Proxy không gọi tới địa chỉ này",
		hint: "Địa chỉ private, loopback và link-local (localhost, 10.x, 192.168.x, 169.254.169.254) bị chặn. Hãy dùng URL công khai, hoặc mở tunnel Tunelo để gọi server trên máy bạn.",
	},
	portBlocked: {
		title: "Proxy không kết nối tới port gửi mail",
		hint: "Port 25, 465 và 587 bị chặn. Hãy dùng port khác.",
	},
	dnsFailed: {
		title: "Không tìm thấy tên miền",
		hint: "Kiểm tra URL có gõ sai không và tên miền có tồn tại không.",
	},
	timeout: {
		title: "Đích không trả lời kịp",
		hint: "Không nhận được gì sau {seconds} giây. Kiểm tra server còn chạy không, hoặc tăng timeout trong phần cài đặt của request.",
	},
	tooManyRedirects: {
		title: "Chuyển hướng quá nhiều lần",
		hint: "Đích chuyển hướng hơn {max} lần. Kiểm tra vòng lặp chuyển hướng, hoặc tắt theo chuyển hướng trong phần cài đặt của request.",
	},
	connectionFailed: {
		title: "Kết nối tới đích thất bại",
		hint: "Kiểm tra server có nhận kết nối ở port này không. Nếu nguyên nhân nhắc tới certificate, hãy kiểm tra chứng chỉ TLS của server.",
	},
	rateLimited: {
		title: "Gửi qua proxy quá nhiều",
		hint: "Đợi một chút rồi thử lại.",
	},
	quotaExceeded: {
		title: "Đã hết request qua proxy của tháng",
		hint: "Bạn đã dùng hết request qua proxy của tháng này. Hãy gửi thẳng, hoặc xem các gói để có thêm.",
	},
	proxyBusy: {
		title: "Quá nhiều request qua proxy cùng lúc",
		hint: "Chờ các request trước xong rồi gửi lại.",
	},
	network: {
		title: "Không kết nối được Localman",
		hint: "Kiểm tra kết nối mạng rồi thử lại.",
	},
	unauthenticated: {
		title: "Bạn đã đăng xuất",
		hint: "Đăng nhập lại để gửi qua proxy.",
	},
};
