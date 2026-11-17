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
		links: {
			title: "Máy đã liên kết",
			hint: "Máy đã liên kết bằng mã trước khi cách liên kết đó bị bỏ. Chỉ bạn thấy tunnel của chúng; hãy xoá máy không còn dùng.",
			unnamed: "Máy chưa mở tunnel nào",
			linkedAt: "Liên kết ngày {date}",
			revoke: "Thu hồi liên kết của {name}",
			revoked: "Đã bị thu hồi trên máy. Hãy xoá.",
		},
	};
