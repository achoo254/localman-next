import type { Messages } from "../../message-types";

export const apiClientTuneloAccounts: Messages["apiClientTunelo"]["accounts"] =
	{
		badge: "Qua Tunelo · {device}",
		basicAuth: "Tunnel này yêu cầu Basic Auth",
		basicAuthBody:
			"Header Authorization của request đã được dùng cho Basic Auth của tunnel, nên app của bạn có thể không nhận được nó.",
		notice: {
			stopped: "Tunnel của {key} đã dừng",
			stoppedBody: "Chạy lại <code>{command}</code> rồi bấm Gửi lại.",
			tcpOnly: "Chỉ có tunnel TCP cho {key}",
			tcpOnlyBody:
				"API client chỉ gửi được HTTP. Mở tunnel HTTP bằng <code>{command}</code>.",
		},
		choose: {
			title: "Chọn tunnel cho {key}",
			body: "Có nhiều tunnel của bạn phục vụ port này. Chọn tunnel sẽ nhận request.",
			basicAuth: "Basic Auth",
			remember: "Lựa chọn được nhớ cho địa chỉ này trên trình duyệt này.",
		},
		connect: {
			title: "Liên kết máy",
			opening: "Đang lấy mã…",
			body: "Trên máy đang chạy tunnel, nhập mã này:",
			command: "Chạy trên máy đó",
			waiting: "Đang chờ máy xác nhận… Mã hết hạn sau 10 phút.",
			linked: "Đã liên kết máy",
			linkedBody:
				"Từ giờ tunnel của máy này được tự tìm cho địa chỉ local của bạn. Bạn có thể thu hồi liên kết ở đây bất cứ lúc nào.",
			expired: "Mã đã hết hạn trước khi máy dùng nó.",
			restart: "Lấy mã mới",
		},
		links: {
			title: "Máy đã liên kết",
			hint: "Tunnel của tài khoản Tunelo được tự tìm khi bạn chạy tunelo login bằng cùng tài khoản. Máy chưa có tài khoản thì liên kết ở đây; chỉ bạn thấy tunnel của nó.",
			add: "Liên kết máy",
			empty: "Chưa liên kết máy nào.",
			unnamed: "Máy chưa mở tunnel nào",
			linkedAt: "Liên kết ngày {date}",
			revoke: "Thu hồi liên kết của {name}",
			revoked: "Đã bị thu hồi trên máy. Hãy xoá, rồi liên kết lại máy nếu cần.",
		},
	};
