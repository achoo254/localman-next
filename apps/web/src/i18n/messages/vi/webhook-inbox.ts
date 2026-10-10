import type { Messages } from "../../message-types";

export const webhookInbox: Messages["webhookInbox"] = {
	title: "Webhook inbox",
	intro:
		"URL công khai để hứng webhook từ dịch vụ bên ngoài. Inbox nhận mọi method, trả response bạn đặt, và có thể forward về máy bạn qua tunnel.",
	count: "{used} / {max} inbox",
	create: "Tạo inbox",
	readonly:
		"Bạn đang xem với quyền collaborator. Chỉ owner của project tạo, sửa và xoá được inbox.",
	loading: "Đang tải inbox…",
	loadFailed: "Không tải được inbox. Hãy thử lại.",
	footnote:
		"Request vào inbox hiện trong Request log với nguồn <code>inbox</code>, bị che header nhạy cảm và tính vào hạn mức request tới mock.",
	empty: {
		title: "Chưa có inbox nào",
		body: "Tạo một inbox, dán URL vào phần cài đặt webhook của dịch vụ bên ngoài rồi xem request đến ngay trong Request log.",
	},
	item: {
		response: "Trả {status} · {contentType}",
		forwards: "Forward tới <code>{target}</code>",
		noForward: "Không forward",
		requests: { other: "{count} request" },
		viewLog: {
			other: "Xem {count} request của inbox {name} trong Request log",
		},
		url: "URL",
		urlItem: "URL của inbox {name}",
		lastForward: "Lần forward gần nhất",
		lastForwardAt: "Lần forward gần nhất {time}",
		noForwardYet: "Chưa có request nào để forward.",
		edit: "Sửa inbox {name}",
		delete: "Xoá inbox {name}",
	},
	remove: {
		title: "Xoá webhook inbox",
		question: "Xoá inbox <code>{name}</code>?",
		body: "URL ngừng nhận ngay, bên gửi sẽ nhận 404. Request đã ghi vẫn ở Request log đến khi hết hạn lưu.",
		confirm: "Xoá inbox",
		done: "Đã xoá inbox <code>{name}</code>.",
	},
	form: {
		titleNew: "Tạo webhook inbox",
		titleEdit: "Sửa inbox {name}",
		name: "Tên",
		nameHint: "Chữ thường không dấu, số và <code>-</code>, tối đa 32 ký tự.",
		urlPreview: "URL:",
		responseTitle: "Response trả cho bên gửi",
		status: "Status",
		contentType: "Content-Type",
		body: "Body",
		forward: "Forward về máy bạn (tuỳ chọn)",
		forwardHelp:
			"Gửi bản sao mỗi request tới tunnel của bạn. Thử lại tối đa 3 lần khi lỗi mạng, quá 30 giây hoặc gặp 5xx. Bên gửi vẫn nhận response ở trên.",
		port: "Port",
		path: "Path",
		target: "Đích: <code>{target}</code>",
		submitNew: "Tạo inbox",
		submitEdit: "Lưu inbox",
		creating: "Đang tạo…",
		saving: "Đang lưu…",
		created:
			"Đã tạo inbox <code>{name}</code>. Dán URL vào phần webhook của dịch vụ gửi.",
		saved: "Đã lưu inbox <code>{name}</code>.",
		forwardFailed:
			"Đã tạo inbox {name} nhưng chưa bật được forward: {reason} Bấm lưu lại để thử lần nữa.",
		errors: {
			nameEmpty: "Nhập tên inbox.",
			nameFormat:
				"Chỉ dùng chữ thường không dấu, số và -, không bắt đầu hay kết thúc bằng -.",
			nameTaken: "Project đã có inbox tên này.",
			status: "Status phải là số nguyên từ 200 đến 599.",
			bodyJson:
				"Body không phải JSON hợp lệ. Đổi Content-Type nếu muốn gửi chữ thường.",
			port: "Port từ 1 đến 65535.",
			path: "Path bắt đầu bằng / và không có dấu cách, ? hay #.",
		},
	},
};
