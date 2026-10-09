import type { Messages } from "../../message-types";

export const apiClientToolsResponse: Messages["apiClientTools"]["response"] = {
	label: "Response",
	empty: {
		title: "Chưa có response",
		hint: "Bấm <b>Send</b> để gửi request. Response sẽ hiện ở đây.",
	},
	sending: "Đang gửi…",
	cancel: "Huỷ request",
	cancelled: "Đã huỷ request.",
	route: {
		direct: "Trực tiếp",
		proxy: "Qua proxy",
		tunelo: "Qua Tunelo",
	},
	meta: {
		status: "Status",
		time: "{ms} ms",
		timeLabel: "Thời gian {ms} ms, xem timings",
		size: "Kích thước",
	},
	timings: {
		title: "Timings",
		dns: "Tra DNS",
		connect: "Kết nối TCP",
		tls: "Bắt tay TLS",
		ttfb: "Chờ phản hồi (TTFB)",
		download: "Tải nội dung",
		total: "Tổng",
		skipped: "không có",
		finalUrl: "URL đích: {url}",
		proxyNote: "Đo từ proxy tới đích, không gồm chặng trình duyệt tới proxy.",
		limited:
			"Gửi thẳng từ trình duyệt: chỉ biết tổng thời gian. DNS, TCP, TLS, TTFB cần đích trả <code>Timing-Allow-Origin</code>, hoặc chọn Proxy.",
	},
	tabs: {
		label: "Các phần của response",
		body: "Body",
		headers: "Headers",
		cookies: "Cookies",
		tests: "Tests",
	},
	body: {
		modes: "Chế độ xem body",
		pretty: "Pretty",
		raw: "Raw",
		preview: "Preview",
		search: "Tìm trong body",
		matches: {
			other: "{count} kết quả",
		},
		matchesCapped: "{count} kết quả đầu",
		copy: "Sao chép body",
		copied: "Đã sao chép body của response.",
		copyBlocked: "Trình duyệt chặn sao chép. Hãy dùng Lưu file.",
		save: "Lưu body ra file",
		saved: "Đã lưu {file}.",
		empty: "Response không có body.",
		binary:
			"Body là dữ liệu nhị phân ({size}) nên không hiện được dạng chữ. Lưu file để mở bằng ứng dụng khác.",
		truncated: "Body đã bị cắt ở {max}. Chỉ phần đầu được hiển thị và lưu.",
		previewHtml: "Xem trước HTML (đã tắt script)",
		previewImage: "Ảnh trong response",
		previewNone:
			"Không xem trước được loại nội dung này. Hãy dùng Pretty hoặc Raw.",
		previewJsonEmpty: "JSON không có dòng nào để hiện dạng bảng.",
		previewJsonRows: {
			other: "Đang hiện {count} dòng",
		},
		previewJsonCapped: "Đang hiện {count} dòng đầu trong {total} dòng.",
	},
	headers: {
		name: "Tên",
		value: "Giá trị",
		empty: "Response không có header nào.",
		directNote:
			"Gửi thẳng: bạn chỉ thấy header mà đích cho phép qua <code>Access-Control-Expose-Headers</code>. Chọn Proxy để xem đủ.",
		proxyNote:
			"<code>Set-Cookie</code> chỉ để hiển thị, không áp vào trình duyệt của bạn.",
	},
	cookies: {
		name: "Tên",
		value: "Giá trị",
		domain: "Domain",
		path: "Path",
		expires: "Hết hạn",
		httpOnly: "HttpOnly",
		secure: "Secure",
		session: "Theo phiên",
		maxAge: "{seconds} giây",
		yes: "Có",
		no: "Không",
		empty: "Response không đặt cookie nào.",
		direct:
			"Gửi thẳng từ trình duyệt: trình duyệt không cho trang đọc <code>Set-Cookie</code>. Chọn <b>Proxy</b> cạnh nút Send để xem cookie đích trả về.",
	},
	tests: {
		summary: "{passed}/{total} test đạt",
		passed: "Đạt",
		failed: "Không đạt",
		none: "Chưa có test nào chạy. Thêm <code>lm.test()</code> vào post-response script để kiểm tra response.",
		scriptError: "Post-response script dừng giữa chừng: {message}",
		scriptErrorAt: "Post-response script dừng ở dòng {line}: {message}",
		console: "Console",
		logsTruncated: "Một phần output của console đã bị cắt.",
	},
};
