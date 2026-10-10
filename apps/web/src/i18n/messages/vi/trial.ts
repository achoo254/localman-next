import type { Messages } from "../../message-types";

export const trial: Messages["trial"] = {
	badge: "Dùng thử miễn phí {days} ngày",
	paidNote: "Hiện chưa có gói trả phí.",
	startGuest: "Dùng thử miễn phí",
	start: "Dùng thử {days} ngày",
	endsIn: { other: "Dùng thử còn {count} ngày" },
	endsToday: "Dùng thử kết thúc hôm nay",
	viewAccount: "Xem trong tài khoản",
	used: "Đã dùng thử",
	requestExtension: "Xin gia hạn",
	tellUs: "Cho chúng tôi biết bạn cần gì ở Pro",
	daysLeft: { other: "Còn {count} ngày" },
	lastDay: "Ngày cuối",
	planName: "Dùng thử Pro · kết thúc {date}",
	confirm: {
		title: "Bắt đầu dùng thử Pro",
		question: "Dùng gói Pro trong {days} ngày, tới hết {date}.",
		once: "Mỗi tài khoản chỉ dùng thử được một lần.",
		after:
			"Khi hết hạn, tài khoản trở về gói Free. Không có dữ liệu nào bị xoá; bạn chỉ không tạo thêm được khi đang vượt hạn mức Free.",
		submit: "Bắt đầu dùng thử",
	},
	started: "Đã bắt đầu dùng thử Pro. Hạn dùng thử tới hết {date}.",
	errors: {
		alreadyUsed:
			"Tài khoản này đã dùng thử Pro. Bạn có thể xin gia hạn ở trang tài khoản.",
		alreadyPro: "Tài khoản của bạn đang ở gói Pro nên không cần dùng thử.",
		extensionPending: "Bạn đã có một yêu cầu gia hạn đang chờ trả lời.",
		notExtendable:
			"Không thể gia hạn lần dùng thử này nữa: chỉ nhận yêu cầu tới một tuần sau khi hết hạn.",
		extensionRateLimited:
			"Hôm nay bạn đã gửi quá nhiều yêu cầu gia hạn. Hãy thử lại vào ngày mai.",
		invalidReason:
			"Lý do chưa hợp lệ. Hãy kiểm tra lý do không trống và không quá dài, rồi gửi lại.",
	},
	extension: {
		title: "Xin gia hạn",
		lead: "Cần thêm thời gian dùng Pro? Hãy cho chúng tôi biết lý do. Nếu yêu cầu được duyệt, lần dùng thử được thêm {days} ngày.",
		reason: "Lý do",
		reasonHint: "Tối đa {max} ký tự. Đội Localman sẽ đọc lý do này.",
		reasonEmpty:
			"Hãy cho chúng tôi biết ngắn gọn vì sao bạn cần thêm thời gian.",
		reasonTooLong: "Lý do chỉ được tối đa {max} ký tự.",
		submit: "Gửi yêu cầu",
		sent: "Đã gửi yêu cầu gia hạn.",
		pending:
			"Đã gửi yêu cầu ngày {date}. Bạn sẽ nhận được thông báo khi có quyết định.",
		approved: "Yêu cầu gần nhất đã được duyệt ngày {date}.",
		declined: "Yêu cầu gần nhất đã bị từ chối ngày {date}.",
	},
	overLimits: {
		title: "Bạn đang vượt hạn mức gói {plan}: {list}.",
		body: "Mọi thứ vẫn chạy bình thường; bạn chỉ không tạo thêm được cho tới khi về dưới hạn mức.",
		separator: ", ",
		projects: "{used}/{max} project",
		resources: "{used}/{max} resource",
	},
};
