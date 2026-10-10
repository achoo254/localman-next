import type { Messages } from "../../message-types";

export const upstream: Messages["upstream"] = {
	tab: "Upstream",
	title: "Upstream cho route mock chưa có",
	intro:
		"Route khớp resource hoặc endpoint đang bật thì mock trả; route còn lại được chuyển nguyên method, header và body tới upstream. Frontend chỉ cần một base URL: <code>{baseUrl}</code>. Response có header <code>X-Localman-Source: mock</code> hoặc <code>upstream</code>.",
	readonly:
		"Bạn đang xem với quyền collaborator. Chỉ owner của project đổi được upstream và các header bị che.",
	loading: "Đang tải upstream…",
	loadFailed: "Không tải được thiết lập upstream. Hãy thử lại.",
	legend: "Chọn upstream",
	options: {
		none: {
			title: "none",
			help: "Không chuyển tiếp: route không khớp trả 404.",
		},
		tunnel: {
			title: "tunnel:<port>",
			help: "Backend trên máy bạn, qua tunnel Tunelo của chính bạn.",
		},
		url: {
			title: "URL",
			help: "Backend đã deploy, ví dụ môi trường staging. Chỉ nhận https công khai.",
		},
	},
	port: {
		label: "Port",
		error: "Port phải nằm trong khoảng 1 đến 65535.",
	},
	unavailableNote:
		"Tunnel dừng thì route chuyển tiếp nhận <code>502 UPSTREAM_UNAVAILABLE</code> kèm gợi ý lệnh.",
	url: {
		label: "URL upstream",
		invalid: "Nhập một URL https công khai, ví dụ https://staging.example.com.",
		blocked:
			"Địa chỉ này trỏ vào mạng nội bộ nên Localman không chuyển tiếp tới được.",
	},
	save: "Lưu upstream",
	saved:
		"Đã đặt upstream là <code>{label}</code>. Route mock chưa có giờ được chuyển tới đó.",
	saveFailed: "Không lưu được upstream",
	current: "Đang dùng: <code>{label}</code>",
	quotaNote:
		"Mọi request vào mock đều tính vào hạn mức request tới mock, kể cả request được chuyển tiếp.",
	tunnel: {
		mapped: "Đã gắn: <code>localhost:{port}</code> → <code>{url}</code>",
		missing:
			"Chưa có ánh xạ cho <code>localhost:{port}</code>. Chạy <code>tunelo http {port}</code> rồi thêm ánh xạ ở <link>Tunelo trong API client</link>.",
		unchecked:
			"Lưu để kiểm tra tunnel của <code>localhost:{port}</code>. Muốn mở tunnel, chạy <code>tunelo http {port}</code> rồi thêm ánh xạ ở <link>Tunelo trong API client</link>.",
		copy: "Sao chép lệnh",
		copyFailed: "Không sao chép được. Hãy tự sao chép: {command}",
	},
	masked: {
		title: "Header bị che",
		intro:
			"Các header này được lưu thành <code>[redacted]</code> trong request log. Thay đổi áp dụng cho request ghi từ bây giờ.",
		always: "Luôn bị che",
		custom: "Che thêm trong project này",
		none: "Chưa có header nào thêm.",
		inputLabel: "Tên header",
		add: "Thêm header",
		remove: "Bỏ che {name}",
		invalid: "Nhập tên header, ví dụ x-session-token.",
		duplicate: "Header này đã bị che.",
		max: "Tối đa {max} header thêm mỗi project.",
		saved: "Đã lưu các header bị che.",
		saveFailed: "Không lưu được các header bị che",
	},
};
