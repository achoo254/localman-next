import type { Messages } from "../../message-types";

export const legalTerms: Messages["legalTerms"] = {
	title: "Điều khoản sử dụng",
	intro:
		"Khi dùng Localman (web app ở {appHost}, các mock API và các MCP endpoint của nó), bạn đồng ý với các điều khoản này và với <privacy>Chính sách quyền riêng tư</privacy>.",
	account: {
		title: "Tài khoản của bạn",
		body: "Bạn đăng nhập bằng tài khoản {idpName}; Localman không giữ mật khẩu. Hãy giữ an toàn cho tài khoản đó: ai đăng nhập được bằng nó đều dùng được dữ liệu Localman của bạn, và các AI agent bạn cấp quyền qua nó hành động với quyền của bạn.",
	},
	limits: {
		title: "Hạn mức",
		body: "Localman đang miễn phí. Hạn mức và mức dùng tháng này hiện ở trang Tài khoản; trong một thời gian tài khoản có thể có hạn mức mở rộng, và trang đó cho biết tới khi nào. Khi hạn mức mở rộng kết thúc, không gì bị xoá: chỉ các mục mới vượt hạn mức bị từ chối. Hạn mức có thể thay đổi.",
	},
	content: {
		title: "Nội dung của bạn",
		body: "Bạn giữ mọi quyền với những gì bạn tạo. Bạn cho phép Localman lưu và xử lý chúng chỉ để chạy các tính năng bạn dùng, như Chính sách quyền riêng tư mô tả.",
	},
	sharing: {
		title: "Những gì bạn chia sẻ",
		body: "- Ai biết URL mock của một project đều gọi được mock API đó, kể cả thành viên bạn đã gỡ. Hãy đổi URL trong project để chặn các bản cũ.\n- Ai có public link của một collection đều đọc được collection đó; giá trị biến secret bị bỏ ra.\n- Người bạn mời vào project hay workspace xem và sửa nội dung theo vai trò của họ.",
	},
	use: {
		title: "Dùng đúng mực",
		body: "Localman áp giới hạn tần suất và hạn mức hằng tháng, và từ chối gửi request tới mạng nội bộ và cổng mail. Đừng tìm cách vượt qua chúng, làm quá tải dịch vụ, hay dùng nó để tấn công hoặc truy cập hệ thống bạn không được phép.",
	},
	cleanup: {
		title: "Dữ liệu không hoạt động và đã xoá",
		body: "Project không hoạt động 90 ngày có thể bị xoá khi chủ project đang có hạn mức thường. Collection đã xoá nằm trong thùng rác 30 ngày rồi bị xoá hẳn. Log request và lịch sử hết hạn như Chính sách quyền riêng tư nói.",
	},
	service: {
		title: "Dịch vụ",
		body: "Localman được cung cấp như hiện có. Dịch vụ có thể thay đổi, gián đoạn hoặc ngừng, và tính năng có thể bị tắt. Chúng tôi không bảo đảm dịch vụ luôn sẵn sàng hay không có lỗi.",
	},
	end: {
		title: "Chấm dứt",
		body: "Bạn có thể <accountDelete>xoá tài khoản Localman</accountDelete> bất cứ lúc nào. Chúng tôi có thể khoá tài khoản vi phạm các điều khoản này.",
	},
	changes: {
		title: "Thay đổi",
		body: "Khi các điều khoản này thay đổi, ngày ở đầu trang đổi theo.",
	},
};
