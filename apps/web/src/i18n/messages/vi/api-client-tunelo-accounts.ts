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
			hint: "Máy đã chạy tunelo login bằng tài khoản này tự liên kết và hiện ở đây. Chỉ bạn thấy tunnel của nó.",
			addSteps:
				"Để thêm máy, chạy lệnh cài trên trang Chat ở máy đó, rồi đăng nhập bằng <code>{command}</code>. Máy tự hiện ở đây.",
			openChat: "Mở trang Thêm máy này trong Chat",
			empty: "Chưa liên kết máy nào.",
			unnamed: "Máy chưa mở tunnel nào",
			linkedAt: "Liên kết ngày {date}",
			revoke: "Thu hồi liên kết của {name}",
			revoked:
				"Đã bị thu hồi trên máy. Hãy xoá, rồi chạy lại tunelo login trên máy nếu cần.",
		},
		machines: {
			badge: "Máy của bạn",
			forward: "Gửi request tới localhost trên {name}",
			forwardHint:
				"Request tới localhost đi tới máy này qua tunnel riêng của nó. Chỉ bạn dùng được.",
			pick: "Chọn cổng trên {name}",
			pickTitle: "localhost trên {name}",
			pickHint:
				"Chọn một cổng đang mở trên máy, hoặc gõ tay. Request tới cổng localhost đó sẽ đi tới máy này.",
			loading: "Đang hỏi máy các cổng đang mở…",
			noPorts:
				"Không có cổng nào đang mở, hoặc máy chưa trả lời. Bạn vẫn gõ tay được.",
			portLabel: "Cổng",
			use: "Dùng localhost:{port}",
			chosen:
				"localhost:{port} giờ đi tới {name}. Đã sao chép http://localhost:{port}/",
			invalidPort: "Hãy gõ cổng từ 1 tới 65535.",
		},
	};
