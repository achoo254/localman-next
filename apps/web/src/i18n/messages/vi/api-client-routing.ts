import type { Messages } from "../../message-types";

export const apiClientRouting: Messages["apiClientRouting"] = {
	rail: { routing: "Định tuyến" },
	badge: {
		direct: "Trực tiếp",
		local: "Trực tiếp (localhost)",
		proxy: "Qua proxy",
		proxyCors: "Qua proxy · CORS chặn",
		tunelo: "Qua Tunelo",
	},
	via: { proxy: "proxy", tunelo: "tunnel Tunelo của bạn" },
	why: {
		manual: {
			direct: "Bạn chọn Trực tiếp cho request này (ô cạnh nút Send).",
			proxy: "Bạn chọn Proxy cho request này (ô cạnh nút Send).",
			tunelo:
				"Bạn chọn Proxy cho request này; địa chỉ local đi qua tunnel Tunelo của nó.",
		},
		direct:
			"Gửi thẳng từ trình duyệt tới {host}; đích cho phép CORS. Request không đi qua server Localman.",
		local:
			"Gửi thẳng từ trình duyệt tới {host} trong mạng của bạn. Thông tin xác thực không rời máy.",
		pinned: "{host} nằm trong “Luôn qua proxy” (cài đặt Định tuyến).",
		forbidden:
			"Trình duyệt không cho đặt {headers} qua fetch, nên request đi qua {via} để giữ header đó.",
		redirects:
			"“Theo redirect” đang tắt mà trình duyệt không cho xem response redirect, nên request đi qua {via}.",
		remembered:
			"{host} vừa gửi thẳng thất bại (thường do CORS), nên request đi thẳng qua {via}. Xoá trong cài đặt Định tuyến.",
		cors: "Gửi thẳng gặp TypeError (thường do đích không trả CORS), nên request được gửi lại qua {via}. Trong 24 giờ, {host} sẽ đi thẳng qua đó.",
	},
	note: {
		cors: "Đã gửi qua {via}: trình duyệt chặn gửi thẳng",
		dropped: "Trình duyệt đã bỏ {headers}",
		droppedHint:
			"fetch không đặt được các header này. Chọn Proxy ở ô cạnh nút Send để giữ chúng.",
	},
	failure: {
		blocked:
			"Trình duyệt không cho gửi thẳng tới {host}: CORS, mixed content, quyền mạng local, hoặc đích không chạy.",
		timeout: "{host} không trả lời trong thời gian chờ.",
		redirect:
			"{host} trả về redirect, mà trình duyệt không cho xem khi “Theo redirect” đang tắt.",
		interrupted:
			"{host} đã trả lời, rồi kết nối đứt khi đang đọc response. Request đã chạy ở đích, nên không tự gửi lại.",
		notRetried:
			"Gửi thẳng tới {host} thất bại, nhưng request này (POST hoặc PATCH) có thể đã tới đích, nên không tự gửi lại.",
		tunnel:
			"{key} nằm trên máy bạn: proxy không gọi tới được và chưa có tunnel nào cho nó.",
		consent:
			"Chưa gửi: request mang thông tin xác thực, cần bạn đồng ý mới gửi qua proxy.",
	},
	direct: {
		title: {
			blocked: "TypeError: Failed to fetch · {host}",
			timeout: "{host} không trả lời",
			redirect: "Trình duyệt che response redirect",
			interrupted: "Response bị cắt ngang · {host}",
			notRetried: "Chưa gửi lại · {host}",
		},
		sendProxy: "Gửi qua proxy",
		tryTunelo: "Thử qua Tunelo",
		useAuto: "Dùng Auto",
	},
	consent: {
		title: "Gửi qua proxy?",
		body: "Không gửi thẳng tới {target} từ trình duyệt được: {reason}. Request mang {parts}.",
		destination: "Proxy sẽ gọi tới {url}",
		reason: {
			pinned: "host được ghim luôn qua proxy",
			forbidden: "có header trình duyệt không cho đặt",
			redirects: "“Theo redirect” đang tắt",
			remembered: "host vừa gửi thẳng thất bại",
			cors: "gửi thẳng thất bại (thường do CORS)",
			defaultRoute: "request mới dùng route Proxy (cài đặt Định tuyến)",
			tunnel: "địa chỉ local chỉ tới được qua tunnel Tunelo",
		},
		note: "Thông tin xác thực đi qua server Localman lúc truyền (không lưu, không log)",
		noteBody:
			"Proxy chỉ chuyển tiếp request. Log của proxy chỉ ghi host, status và thời gian.",
		remember: "Không hỏi lại cho {host}",
		hint: "Đổi lại trong cài đặt Định tuyến. Muốn thông tin xác thực không rời máy, hãy bật CORS ở đích.",
		confirm: "Gửi qua proxy",
		blockedTitle: "Chưa gửi: cần bạn đồng ý gửi qua proxy",
		blockedBody: "Request mang {parts}. Chưa có gì được gửi.",
		reopen: "Gửi qua proxy…",
	},
	quota: { plans: "Xem gói" },
	settings: {
		title: "Định tuyến",
		loading: "Đang tải cài đặt định tuyến…",
		defaultRoute: "Đường đi của request mới",
		defaultHint:
			"Auto gửi thẳng từ trình duyệt, không được thì chuyển sang proxy (CORS, header fetch không đặt được, tắt redirect). Địa chỉ local thì dùng Tunelo. Ô chọn cạnh nút Send ghi đè cho từng request.",
		pinned: {
			title: "Luôn qua proxy",
			hint: "Auto gửi các host này qua proxy, không thử gửi thẳng.",
			input: "Host",
			placeholder: "api.example.com",
			add: "Thêm",
			invalid: "Hãy nhập tên host hoặc IP, có thể kèm port.",
			empty: "Chưa có host nào.",
			remove: "Bỏ {host}",
		},
		secrets: {
			title: "Thông tin xác thực qua proxy không cần hỏi",
			hint: "Các host bạn đã chọn “Không hỏi lại”.",
			empty: "Chưa có host nào.",
			remove: "Hỏi lại cho {host}",
		},
		cors: {
			title: "Vừa bị chặn (cache CORS)",
			hint: "Origin gửi thẳng thất bại trên trình duyệt này sẽ đi qua proxy trong 24 giờ.",
			empty: "Không có origin nào bị chặn.",
			clear: "Xoá cache",
			cleared: "Đã xoá cache CORS.",
			forget: "Quên {origin}",
			until: "đến {time}",
		},
	},
};
