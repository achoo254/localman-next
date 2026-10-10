import type { Messages } from "../../message-types";

export const mockCallbacks: Messages["mockCallbacks"] = {
	title: "Callbacks",
	subtitle: "Gửi request khi bản ghi thay đổi qua mock",
	add: "Thêm callback",
	max: "Tối đa {max} callback mỗi resource.",
	readonly:
		"Bạn đang xem với quyền collaborator. Chỉ owner của project sửa được callback.",
	empty:
		"Chưa có callback. Thêm một callback để mock gửi request tới server của bạn khi có create, update hoặc delete.",
	variables:
		"Biến: <code>{record}</code> bản ghi dạng JSON, <code>{field}</code> một field của bản ghi, <code>{event}</code> là create, update hoặc delete, <code>{resource}</code> tên resource. Gửi nền, thử lại tối đa 3 lần có giãn cách, kết quả ghi vào Request log với nguồn <code>callback</code>.",
	saveNote:
		"Callback được lưu riêng: bấm Lưu callback để lưu, nút lưu resource không lưu phần này.",
	loading: "Đang tải callback…",
	loadFailed: "Không tải được callback. Hãy thử lại.",
	save: "Lưu callback",
	saving: "Đang lưu…",
	unsaved: "Có thay đổi chưa lưu",
	saved: "Đã lưu callback.",
	invalid: "Có callback chưa hợp lệ. Hãy xem các ô được đánh dấu.",
	item: {
		enable: "Bật callback {n}",
		event: "Sự kiện của callback {n}",
		on: "khi",
		remove: "Xoá callback {n}",
		target: "Đích",
		targetPlaceholder:
			"https://hooks.example.com/users hoặc tunnel:3000/hooks/users",
		body: "Body template",
		headers: "Header",
		headerName: "Tên header {i}",
		headerValue: "Giá trị header {i}",
		valuePlaceholder: "giá trị",
		hiddenPlaceholder: "Đã ẩn",
		hiddenHint:
			"Giá trị đã ẩn giữ nguyên như đã lưu nếu bạn không nhập giá trị mới.",
		addHeader: "Thêm header",
		removeHeader: "Xoá header {name}",
	},
	test: {
		send: "Gửi thử",
		sending: "Đang gửi…",
		sent: "Đã gửi thử callback tới <code>{target}</code>.",
		failed: {
			other: "Gửi thử tới <code>{target}</code> thất bại sau {count} lần thử.",
		},
		busy: "Vẫn còn lượt gửi thử khác đang chạy. Hãy đợi xong rồi thử lại.",
		result: "Gửi thử tới <code>{target}</code>:",
		response: "Body của response",
		truncated: "Đã cắt ở 64 KB.",
	},
	last: {
		never: "Chưa gửi lần nào.",
		sent: "Gần nhất {time}:",
		attempts: "{ms} ms sau {n}/{max} lần thử",
	},
	errors: {
		targetEmpty: "Nhập URL https hoặc tunnel:<port><path>.",
		targetHttp: "Chỉ nhận https. Để gửi về máy bạn, dùng tunnel:<port><path>.",
		targetFormat:
			"Đích là URL https hoặc tunnel:<port><path>, ví dụ tunnel:3000/hooks/users.",
		targetPort: "Port từ 1 đến 65535.",
		body: "Body sau khi thay biến không phải JSON hợp lệ. Lưu ý {record} không đặt trong dấu ngoặc kép.",
		bodyTooLarge: "Body template quá lớn: tối đa 64 KB.",
		headerName: "Dùng tên header hợp lệ, ví dụ X-Hook-Secret.",
		headerReserved: "{name} do Localman tự đặt. Hãy dùng header khác.",
		headerValue: "Giá trị header chỉ nằm trên một dòng.",
		headerMax: "Tối đa {max} header mỗi callback.",
		headersRefused: "Server từ chối một header. Hãy kiểm tra tên và giá trị.",
	},
	delivery: {
		attempts: "Các lần thử gửi, tối đa {max}",
		attempt: "Lần thử {n}/{max}",
		ms: "{ms} ms",
		answered: "Trả về {status}",
		errors: {
			noTunnel: "Chưa có ánh xạ tunnel cho port này",
			connect: "Không kết nối được",
			timeout: "Hết thời gian chờ",
			dns: "Không phân giải được tên miền",
			blocked: "Bị chặn: địa chỉ nội bộ hoặc dành riêng",
			bodyTooLarge: "Body quá lớn để gửi",
			invalidTarget: "Đích không hợp lệ",
			queueFull: "Tài khoản đang có quá nhiều lượt gửi chờ; chưa gửi",
			quotaExceeded: "Đã hết lượt mock request trong tháng; chưa gửi",
			expired: "Không gửi được trong vòng một giờ; đã bỏ",
		},
	},
};
