import type { Messages } from "../../message-types";

export const apiClientTunelo: Messages["apiClientTunelo"] = {
	rail: "Tunelo",
	title: "Tunelo",
	intro:
		"Test API trên localhost ngay trên trình duyệt: mở nó ra bằng một lệnh Tunelo, rồi gắn địa chỉ local với URL tunnel ở đây.",
	steps: {
		label: "Mở tunnel",
		install: "Cài Tunelo (cần Node 20+)",
		login: "Đăng nhập thiết bị",
		http: "Mở tunnel cho port {port}",
		tcpHint:
			"API client chỉ gửi được HTTP. Dịch vụ TCP thì Tunelo có <code>tunelo tcp {port}</code>.",
	},
	warning: {
		title: "Tunnel mở dịch vụ local ra internet",
		body: "Khi tunnel chạy, ai có URL đều gọi được app trên máy bạn. Dùng <code>-a user:pass</code> nếu dữ liệu nhạy cảm, và nhấn Ctrl+C để dừng tunnel khi test xong.",
	},
	form: {
		title: "Gắn một địa chỉ local",
		local: "Địa chỉ local",
		localPlaceholder: "http://localhost:3000",
		tunnel: "URL tunnel",
		tunnelPlaceholder: "https://ten-cua-ban.{domain}",
		add: "Lưu ánh xạ",
		invalidLocal:
			"Hãy nhập địa chỉ trên máy hoặc mạng của bạn, ví dụ http://localhost:3000.",
		invalidTunnel:
			"Hãy dán URL https mà Tunelo in ra, ví dụ https://ten-cua-ban.{domain}.",
		noDomains:
			"Server này chưa cấu hình domain tunnel nào, nên chưa lưu được URL tunnel.",
		saved: "Request tới {key} giờ đi qua tunnel.",
	},
	mappings: {
		title: "Ánh xạ",
		hint: "Request tới địa chỉ local đã gắn sẽ đi qua tunnel của nó, giữ nguyên path và query. Chỉ bạn thấy ánh xạ của mình.",
		empty: "Chưa có ánh xạ.",
		loading: "Đang tải ánh xạ…",
		use: "Dùng tunnel cho {key}",
		delete: "Xoá ánh xạ của {key}",
	},
	panel: {
		title: "Gửi tới máy local qua Tunelo",
		reason: "Proxy không gọi được {key}",
		reasonBody:
			"Proxy của Localman chạy trên server nên chặn localhost và IP LAN. Hãy mở tunnel bằng Tunelo rồi dán URL bên dưới.",
		directFailed: "Đã thử gửi thẳng tới {key}",
		directFailedBody:
			"Trình duyệt từ chối: dev server không trả CORS cho trang này, hoặc quyền mạng local bị chặn.",
		recheck: "Gửi lại",
		paste: "Hoặc dán URL tunnel",
		pasteSubmit: "Thay host và gửi lại",
	},
	cors: {
		title: "Hoặc bật CORS ở dev server",
		body: "Cho phép {origin} ở dev server để gửi thẳng: khi đó thông tin xác thực không rời máy bạn.",
		framework: "Framework",
	},
	badge: {
		label: "Qua Tunelo",
		tip: "Gửi tới {url}",
		unmap: "Bỏ ánh xạ của {key}",
	},
};
