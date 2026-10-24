import type { Messages } from "../../message-types";

export const secretVault: Messages["secretVault"] = {
	title: "Kho secret",
	header: {
		label: "Kho secret: {state}",
		state: {
			none: "Chưa có kho",
			locked: "Đã khoá",
			unlocked: "Đã mở",
		},
	},
	menu: {
		note: "Đang mở trên thiết bị này",
		lock: "Khoá lại",
		reset: "Đặt lại kho…",
	},
	passphrase: {
		label: "Passphrase",
		show: "Hiện passphrase",
		hide: "Che passphrase",
	},
	strength: {
		empty: "Ít nhất {min} ký tự",
		short: "Quá ngắn: cần ít nhất {min} ký tự",
		weak: "Yếu: nên dài hơn hoặc trộn chữ, số, khoảng trắng",
		fair: "Khá: dài thêm vài từ sẽ mạnh hơn",
		strong: "Mạnh",
	},
	create: {
		title: "Tạo kho secret",
		titleAfterReset: "Tạo kho mới",
		afterReset:
			"Kho cũ đã bị xoá. Đặt passphrase cho kho mới, rồi nhập lại giá trị local của các biến secret.",
		intro:
			"Giá trị local của biến secret (environment, globals, biến collection) được mã hoá ngay trong trình duyệt bằng khoá sinh từ passphrase của bạn. Server chỉ lưu bản đã mã hoá. Giá trị shared của team không đổi.",
		tip: "Gợi ý: một cụm 4 đến 5 từ chỉ bạn nhớ. Lưu vào trình quản lý mật khẩu.",
		confirm: "Nhập lại passphrase",
		mismatch: "Hai passphrase chưa khớp",
		warningTitle: "Quên passphrase là mất giá trị, không khôi phục được",
		warningBody:
			"Chúng tôi không lưu passphrase và không giải mã được dữ liệu của bạn. Quên passphrase thì mọi giá trị local của biến secret bị mất; chỉ còn cách đặt lại kho và nhập lại từ đầu.",
		ack: "Tôi hiểu: quên passphrase thì giá trị local của biến secret không khôi phục được.",
		busy: "Đang tạo khoá, việc này mất một lúc…",
		submit: "Tạo kho",
		created: "Đã tạo kho secret. Kho đang mở trên thiết bị này.",
	},
	unlock: {
		title: "Mở kho secret",
		intro:
			"Nhập passphrase để giải mã giá trị local của biến secret trong trình duyệt này.",
		empty: "Nhập passphrase của kho",
		wrong:
			"Passphrase không đúng. Kiểm tra Caps Lock và bộ gõ tiếng Việt rồi thử lại.",
		busy: "Đang kiểm tra passphrase…",
		forgot: "Quên passphrase?",
		submit: "Mở kho",
		unlocked: "Đã mở kho secret.",
	},
	lock: {
		locked:
			"Đã khoá kho secret. Request dùng giá trị local của biến secret sẽ dừng cho tới khi mở kho.",
	},
	reset: {
		title: "Đặt lại kho secret",
		question: "Xoá mọi giá trị local của biến secret?",
		body: "Không có cách khôi phục passphrase. Đặt lại sẽ xoá kho và mọi giá trị local kho đã mã hoá, trên mọi thiết bị của bạn, sau đó bạn tạo kho mới với passphrase mới.",
		agents:
			"Bản sao cho agent dùng cũng bị xoá. Giá trị shared của team không bị ảnh hưởng.",
		confirmLabel: "Gõ <code>{word}</code> để xác nhận",
		submit: "Xoá và tạo kho mới",
		done: {
			other: "Đã xoá kho cũ cùng {count} giá trị local.",
		},
	},
};
