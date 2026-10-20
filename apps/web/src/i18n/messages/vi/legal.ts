import type { Messages } from "../../message-types";

export const legal: Messages["legal"] = {
	effective: "Có hiệu lực từ {date}",
	nav: {
		label: "Văn bản pháp lý",
		privacy: "Quyền riêng tư",
		terms: "Điều khoản",
		deleteAccount: "Xoá tài khoản",
	},
	signUpNote:
		"Khi đăng ký, bạn đồng ý với <terms>Điều khoản</terms> và <privacy>Chính sách quyền riêng tư</privacy>.",
	contact: {
		title: "Liên hệ",
		body: "Câu hỏi hoặc yêu cầu về dữ liệu của bạn hay các điều khoản này: dùng “Góp ý / Liên hệ” ở cuối mọi trang của Localman. Localman không có email liên hệ; hãy để lại cách liên lạc trong form nếu bạn muốn được trả lời.",
	},
	accountDelete: {
		title: "Xoá tài khoản Localman",
		intro:
			"Bạn có thể tự xoá tài khoản Localman và dữ liệu của nó bất cứ lúc nào, ngay trên web app. Trang này nói cách làm và điều gì sẽ xảy ra.",
		deleted:
			"Đã xoá tài khoản Localman của bạn. Đăng nhập lại sẽ tạo một tài khoản mới, trống.",
		howTitle: "Cách xoá",
		how: "- Đăng nhập Localman.\n- Trong menu tài khoản, mở <b>Tài khoản và hạn mức</b>.\n- Ở mục <b>Xoá tài khoản</b>, chọn <b>Xoá tài khoản…</b>, xem lại những gì sẽ bị xoá, gõ username của bạn rồi xác nhận.",
		openAccount: "Tới trang Tài khoản",
		whatTitle: "Những gì bị xoá",
		what: "- Các mock project bạn sở hữu, cùng resource, dữ liệu, log request, webhook inbox và callback của chúng, kể cả với những người bạn đã chia sẻ.\n- Workspace cá nhân và các workspace team chỉ có mình bạn, cùng collection và environment trong đó.\n- Lịch sử, tab đang mở và cài đặt của API client, thông báo và cài đặt thông báo, thiết bị Web Push, bộ đếm mức dùng, liên kết tới máy Tunelo (bị thu hồi ở Tunelo), tin bạn gửi qua form góp ý khi đã đăng nhập, và mọi phiên đăng nhập.\n- Ở workspace team còn thành viên khác, bạn rời workspace. Những gì bạn viết ở đó (collection, request, comment, changelog) thuộc về team nên được giữ lại, nhưng tên bạn bị gỡ khỏi chúng.",
		blockedTitle: "Khi việc xoá phải chờ",
		blocked:
			"Nếu bạn là Admin duy nhất của một workspace team còn thành viên khác, hãy cho một thành viên khác làm Admin (hoặc gỡ các thành viên khác) trước. Màn hình xoá liệt kê các workspace đó.",
		keptTitle: "Những gì còn lại, và trong bao lâu",
		kept: "- Cơ sở dữ liệu được sao lưu mỗi đêm và giữ 14 bản gần nhất, nên dữ liệu đã xoá có thể còn trong bản sao lưu tối đa 14 ngày.\n- Thông báo người khác đã nhận về việc bạn làm giữ nguyên chữ lúc gửi cho tới khi hết hạn (90 ngày).\n- Tin bạn gửi qua form góp ý khi chưa đăng nhập không gắn được với tài khoản của bạn; hãy yêu cầu xoá qua form.",
		idpTitle: "Tài khoản đăng nhập {idpName}",
		idp: "Localman không giữ mật khẩu của bạn: bạn đăng nhập bằng tài khoản {idpName}, tài khoản mà các ứng dụng khác cũng có thể dùng. Xoá tài khoản Localman không xoá tài khoản đó. Muốn xoá cả nó, hãy vào <idpDelete>trang tài khoản {idpName}</idpDelete>.",
		noAccessTitle: "Không đăng nhập được?",
		noAccess:
			"Dùng “Góp ý / Liên hệ” ở cuối trang này: cho biết tài khoản bạn muốn xoá và cách liên lạc với bạn.",
	},
};
