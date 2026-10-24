import type { Messages } from "../../message-types";

export const agentUse: Messages["agentUse"] = {
	title: "Cho agent dùng",
	vault: {
		noneTitle: "Chưa có kho secret",
		noneBody:
			"Biến secret ở đây chỉ dùng giá trị shared. Muốn đặt giá trị local cho biến secret, hãy tạo kho trước: giá trị được mã hoá ngay trong trình duyệt bằng passphrase của bạn.",
		create: "Tạo kho",
		lockedTitle: "Kho secret đang khoá",
		lockedBody: {
			other:
				"{count} giá trị local của biến secret đang ẩn. Request dùng các biến này sẽ dừng, không gửi, cho tới khi mở kho.",
		},
		lockedEmpty: "Mở kho để đặt giá trị local cho biến secret.",
		unlock: "Mở kho",
		badge: "Đã khoá",
		cell: {
			locked: "Mở kho để xem",
			lockedLabel: "Giá trị local của {name} đã khoá. Mở kho để xem",
			empty: "Chưa có giá trị local",
			emptyAction: "Mở kho để đặt",
			emptyLabel: "Chưa có giá trị local cho {name}. Mở kho để đặt",
			none: "Đặt giá trị local…",
			noneAction: "Cần tạo kho",
			noneLabel: "Đặt giá trị local cho {name}: cần tạo kho secret trước",
		},
		renameLocked: "Mở kho secret để đổi tên: giá trị local của biến đang khoá.",
		unreadable: "Mã hoá bằng kho khác: nhập giá trị mới hoặc reset",
		unreadableBadge: "Không mở được",
		exists: "Tài khoản này đã có kho secret. Hãy mở bằng passphrase của kho.",
		needUnlock: "Mở kho secret trước",
		needCreate: "Cần tạo kho secret trước",
		skipped: {
			other: "Bỏ qua {count} giá trị local đang khoá cho tới khi mở kho.",
		},
		saveLocked: "kho secret đang khoá. Mở kho để lưu giá trị của biến secret.",
		saveLockedTitle: "Chưa lưu: mở kho secret để lưu giá trị của biến secret.",
		failed: "Không mở được kho secret. Hãy thử lại.",
	},
	control: {
		off: "Cho agent dùng {name}: đang tắt. Chọn host",
		offTitle: "Cho agent dùng: đang tắt. Bấm để chọn host được phép",
		on: "Cho agent dùng {name}: đang bật cho {hosts}. Sửa host",
		onTitle: "Agent được dùng {name} khi gửi tới {hosts}",
		renameBlocked:
			"Tắt cho agent dùng trước khi đổi tên: server bỏ danh sách host theo tên cũ.",
		gatedUnlock: "Mở kho secret để đổi Cho agent dùng của giá trị local.",
		gatedCreate: "Tạo kho secret để đổi Cho agent dùng của giá trị local.",
	},
	menu: {
		enable: "Cho agent dùng…",
		edit: "Sửa host cho agent",
		hosts: { other: "{count} host" },
		off: "Tắt cho agent dùng",
	},
	dialog: {
		titleEnable: "Cho agent dùng biến secret",
		titleEdit: "Sửa host cho agent",
		intro:
			"Agent AI kết nối qua MCP gửi được request dùng <code>{token}</code>, nhưng server chỉ điền secret này vào request tới đúng các host bạn liệt kê. Agent không bao giờ thấy giá trị.",
		hostsLabel: "Host được phép (mỗi dòng một host)",
		count: "{count}/{max} host.",
		needOne: "Cần ít nhất 1 host.",
		help: "Ví dụ <code>api.example.com</code>, hoặc <code>*.example.com</code> cho mọi subdomain. Không dùng được host của {app}.",
		suggested: "Gợi ý từ base URL:",
		suggestionsLabel: "Gợi ý host từ base URL",
		addHost: "Thêm {host}",
		localTitle: "Giá trị local của bạn không còn chỉ nằm trong trình duyệt",
		localBody:
			"Máy chủ giữ thêm một bản mã hoá giá trị local của bạn (bằng khoá của server, không cần passphrase) để điền vào request của agent. Tắt, xoá giá trị local hoặc đặt lại kho thì bản này bị xoá.",
		sharedTitle: "Chỉ agent của chính bạn",
		sharedBody:
			"Bật ở đây chỉ cho agent của bạn dùng giá trị shared. Người khác trong team muốn agent của họ dùng thì phải tự bật, với danh sách host của họ.",
		factsLabel: "Điều này cho phép gì",
		factOutside:
			"Request tới host ngoài danh sách: server không điền secret này.",
		factRedirect: "Redirect sang host khác không được theo.",
		factOnlyYou:
			"Chỉ bạn bật, tắt hay sửa danh sách được, trong trình duyệt. Agent không tự làm được.",
		submitEnable: "Cho agent dùng",
		submitEdit: "Lưu host",
		turnOff: "Tắt cho agent dùng",
		lineError: "Dòng {line} ({host}): {reason}",
		tooMany: "Tối đa {max} host.",
		problems: {
			scheme: "chỉ nhập host, không kèm https://, cổng hay đường dẫn",
			format:
				"không phải host hợp lệ (ví dụ api.example.com hoặc *.example.com)",
			open: "quá rộng: wildcard phải nằm trong domain của một chủ, không phải *.com, *.co.uk hay host dùng chung như *.herokuapp.com",
			app: "secret không bao giờ được gửi tới host của {app}",
			duplicate: "trùng dòng {line}",
		},
		errors: {
			notSecret:
				"Agent chỉ dùng được biến secret đã lưu. Hãy lưu biến ở dạng secret rồi thử lại.",
			invalid: "Server không nhận các host này. Kiểm tra lại rồi thử lại.",
			failed: "Không lưu được danh sách host. Hãy thử lại.",
			copyFailed:
				"Không chuẩn bị được giá trị local cho agent nên chưa bật gì. Hãy thử lại.",
			vaultLocked: "Mở kho secret để cho agent dùng giá trị local của bạn.",
		},
	},
	toast: {
		enabled: {
			other:
				"Agent dùng được {name} khi gửi tới {count} host, không thấy giá trị.",
		},
		saved: { other: "Đã lưu {count} host cho agent dùng {name}." },
		off: "Agent không còn dùng được {name}.",
		offLocal:
			"Agent không còn dùng được {name}. Server đã xoá bản mã hoá dành cho agent.",
		offFailed: "Không tắt được cho agent dùng {name}. Hãy thử lại.",
	},
};
