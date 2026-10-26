import type { Messages } from "../../message-types";

export const legalPrivacy: Messages["legalPrivacy"] = {
	title: "Chính sách quyền riêng tư",
	intro:
		"Localman (web app ở {appHost}, các mock API và các MCP endpoint của nó) giúp bạn dựng mock API và gửi request API. Chính sách này nói Localman lưu gì, để làm gì, gửi cho ai, giữ bao lâu và bạn có thể làm gì với dữ liệu đó. “Chúng tôi” là người vận hành Localman.",
	collect: {
		title: "Chúng tôi lưu gì",
		body: "- <b>Tài khoản của bạn:</b> những gì tài khoản {idpName} chia sẻ khi bạn đăng nhập và trong lúc bạn còn đăng nhập: mã tài khoản, username, tên hiển thị, link ảnh đại diện, địa chỉ email và việc email đã được xác minh hay chưa, và chat Telegram bạn đã liên kết ở đó (nếu có). Cùng với hạn mức đang áp dụng cho tài khoản, hạn mức mở rộng kéo dài tới khi nào, và ngôn ngữ giao diện. Localman không có mật khẩu của bạn.\n- <b>Phiên đăng nhập:</b> một cookie phiên và, trên server, các token đăng nhập của phiên đó, được mã hoá.\n- <b>Những gì bạn tạo:</b> mock project, resource và dữ liệu của chúng, rule, webhook inbox và callback; collection, request, example, environment và biến của API client (giá trị secret được mã hoá), comment, fork và pull request; các tab request đang mở, lịch sử và cài đặt của bạn.\n- <b>Log request của mock:</b> với request tới mock API và webhook inbox của bạn: thời điểm, method, path, query, status, thời gian xử lý, header và body của request và response. Body bị cắt ở 64 KB; header Authorization, Cookie, Set-Cookie, X-API-Key và các header bạn chọn ẩn được lưu là “[redacted]”.\n- <b>Lịch sử API client:</b> mỗi request đúng như bạn viết, biến giữ nguyên dạng tên chứ không phải giá trị, cùng status, thời gian và kích thước của response; không có header hay body của response.\n- <b>Bộ đếm mức dùng:</b> số request mock và proxy mỗi tháng, để áp hạn mức.\n- <b>Thông báo</b> gửi cho bạn, cài đặt thông báo và, nếu bạn bật Web Push, địa chỉ push của từng trình duyệt.\n- <b>Form góp ý và liên hệ:</b> nội dung bạn gửi và, nếu bạn điền, tên và email hoặc username Telegram để trả lời; tài khoản của bạn nếu bạn đang đăng nhập.\n- <b>Máy Tunelo đã liên kết:</b> link token (được mã hoá) và tên máy.\n- <b>Log kỹ thuật:</b> với mọi request tới server: mã request, method, route, status và thời gian xử lý; không bao giờ có header, cookie, body hay query string. Request gửi qua proxy của API client có thêm mã tài khoản của bạn và host đích.\n- <b>Giới hạn tần suất:</b> bộ đếm theo mã băm của dải địa chỉ IP hoặc tài khoản của bạn, bị xoá khi hết khung thời gian.\n\nLocalman không có quảng cáo và không dùng công cụ phân tích hay theo dõi nào trong app; trang web dùng Cloudflare Web Analytics để đếm lượt xem trang, công cụ này không đặt cookie và không lưu gì trên thiết bị của bạn. Trình duyệt lưu ngôn ngữ, giao diện sáng/tối và một số trạng thái của app (trang đang mở, thứ tự sắp xếp, tunnel đã chọn) trong local storage trên máy bạn.",
	},
	purposes: {
		title: "Chúng tôi dùng dữ liệu để làm gì",
		body: "- Chạy các tính năng bạn dùng: phục vụ mock API, gửi request của bạn, chia sẻ với người bạn mời, báo cho bạn qua các kênh bạn chọn.\n- Áp hạn mức sử dụng, giới hạn tần suất và chặn lạm dụng.\n- Giữ an toàn cho tài khoản, tìm và sửa lỗi.",
	},
	processors: {
		title: "Ai khác nhận dữ liệu",
		body: "- <b>Dịch vụ tài khoản {idpName}</b> (<idp>{idpHost}</idp>): đăng nhập cho bạn và gửi cho Localman các thông tin tài khoản nêu trên. Đây là dịch vụ riêng, có trang tài khoản riêng.\n- <b>Cloudflare</b>: DNS của Localman, và chuyển lưu lượng của web app và dashboard API. Khi bạn gửi form mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn không phải bot. Request tới các subdomain của mock API không đi qua Cloudflare. <cloudflare>Chính sách quyền riêng tư của Cloudflare</cloudflare>.\n- <b>Telegram</b>: chỉ khi bạn bật thông báo Telegram, nội dung thông báo được gửi tới chat đã liên kết qua bot API của Telegram. Khi ai đó gửi form góp ý, một đoạn trích ngắn (tối đa 300 ký tự) kèm địa chỉ liên hệ đã che được gửi tới chat Telegram của người vận hành. <telegram>Chính sách quyền riêng tư của Telegram</telegram>.\n- <b>Dịch vụ push của trình duyệt</b> (do hãng làm trình duyệt cung cấp): chỉ khi bạn bật Web Push, dịch vụ này đưa thông báo tới thiết bị của bạn.\n- <b>Tunelo</b> (<tunelo>{tunnelHost}</tunelo>): chỉ khi bạn dùng Tunelo cùng Localman, Localman đọc danh sách tunnel của bạn và gửi request tới app trên máy bạn qua các tunnel đó.\n- <b>Địa chỉ do bạn chọn:</b> request bạn gửi bằng proxy của API client, upstream của mock, callback và forward của inbox đi tới các địa chỉ bạn đặt, với nội dung bạn đặt.",
	},
	location: {
		title: "Dữ liệu nằm ở đâu",
		body: "Máy chủ đặt tại Việt Nam: các server của Localman ở {appHost} nằm tại Việt Nam và dữ liệu của bạn được lưu ở đó; các dịch vụ nêu trên có thể xử lý dữ liệu ở nơi khác, theo chính sách của họ.",
	},
	retention: {
		title: "Chúng tôi giữ dữ liệu bao lâu",
		body: "- <b>Tài khoản, project, collection và cài đặt:</b> tới khi bạn xoá chúng hoặc xoá tài khoản.\n- <b>Log request của mock:</b> 7 ngày với hạn mức thường, 30 ngày khi đang có hạn mức mở rộng, và tối đa 20.000 dòng mới nhất mỗi project.\n- <b>Lịch sử API client:</b> 90 ngày, tối đa 500 mục.\n- <b>Thông báo:</b> 90 ngày.\n- <b>Phiên đăng nhập:</b> kết thúc sau 30 ngày không dùng, và chậm nhất sau 90 ngày.\n- <b>Collection đã xoá:</b> nằm trong thùng rác 30 ngày.\n- <b>Tin góp ý và liên hệ:</b> tới khi người vận hành xoá.\n- <b>Project không hoạt động</b> 90 ngày có thể bị người vận hành xoá khi chủ project đang có hạn mức thường.\n- <b>Tài khoản đã xoá:</b> sau khi xoá chỉ giữ lại mã băm của mã tài khoản, để khi cùng tài khoản {idpName} đăng nhập lại thì được hỏi trước khi tạo tài khoản mới và không được thêm một lần hạn mức mở rộng.\n- <b>Sao lưu:</b> cơ sở dữ liệu được sao lưu mỗi đêm và giữ 14 bản gần nhất trên server, nên dữ liệu đã xoá có thể còn trong bản sao lưu tối đa 14 ngày.",
	},
	rights: {
		title: "Bạn có thể làm gì",
		body: "- <b>Xem và xuất:</b> xuất collection và environment ra file; xem log request và lịch sử ngay trong app.\n- <b>Sửa và xoá:</b> sửa hoặc xoá project, dữ liệu, collection, environment, lịch sử và comment bất cứ lúc nào.\n- <b>Thông báo:</b> chọn kênh cho từng loại sự kiện, hoặc tắt hẳn.\n- <b>Xoá tài khoản:</b> ở trang Tài khoản, mục “Xoá tài khoản”. <accountDelete>Những gì bị xoá</accountDelete>. Tài khoản đăng nhập {idpName} được xoá riêng, ở <idpDelete>trang tài khoản của nó</idpDelete>.\n- Yêu cầu khác về dữ liệu: xem mục Liên hệ bên dưới.",
	},
	security: {
		title: "Bảo mật",
		body: "Kết nối dùng HTTPS. Script không đọc được cookie phiên. Token đăng nhập, giá trị biến secret và link token của Tunelo được mã hoá khi lưu; token lời mời, access key và MCP token chỉ được lưu dạng mã băm. Không hệ thống nào an toàn tuyệt đối.",
	},
	changes: {
		title: "Thay đổi",
		body: "Khi chính sách này thay đổi, ngày ở đầu trang đổi theo.",
	},
};
