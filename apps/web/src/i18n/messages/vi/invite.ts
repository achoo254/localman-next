import type { Messages } from "../../message-types";

export const invite: Messages["invite"] = {
	pageTitle: "Lời mời tham gia project",
	signIn: {
		title: "Bạn được mời tham gia một project trên Localman",
		text: "Đăng nhập hoặc tạo tài khoản {idpName} để xem lời mời. Xong bạn sẽ quay lại trang này.",
		signIn: "Đăng nhập",
		signUp: "Đăng ký",
	},
	loading: "Đang kiểm tra lời mời…",
	failedTitle: "Không mở được lời mời",
	backToProjects: "Về Projects",
	toast: {
		joined: "Đã tham gia {project}",
		alreadyMember: "Bạn đã là thành viên của {project}",
	},
	invalid: {
		expiredTitle: "Link mời đã hết hạn",
		expiredText: "Link hết hạn ngày {date}. Nhờ người mời gửi link mới.",
		expiredTextNoDate: "Nhờ người mời gửi link mới.",
		usedTitle: "Link mời đã được dùng",
		usedText: "Mỗi link mời chỉ dùng được một lần. Nhờ người mời gửi link mới.",
		revokedTitle: "Link mời không còn hiệu lực",
		revokedText: "Chủ project đã thu hồi link này hoặc link không đúng.",
	},
	preview: {
		title: "Tham gia {project}",
		inviter: "{inviter} mời bạn cộng tác.",
		expiresShared: "Link dùng chung · hết hạn {date}",
		expires: "Hết hạn {date}",
		signedInAs: "Bạn đang đăng nhập bằng <b>{account}</b>",
		alreadyMember: "Bạn đã là thành viên của {project}.",
		openProject: "Mở project",
		full: "Project đã hết chỗ cho thành viên. Nhờ chủ project xoá bớt thành viên.",
		removed:
			"Chủ project đã gỡ bạn khỏi project này. Liên hệ chủ project nếu cần tham gia lại.",
		ineligibleTitle: "Tài khoản này không nhận được lời mời",
		ineligibleOther:
			"Lời mời này gửi cho một tài khoản khác. Hãy đăng nhập bằng tài khoản được mời.",
		ineligibleUnverified:
			"Lời mời gửi cho {email}. Email của tài khoản này chưa được xác minh: hãy đăng nhập bằng Google, GitHub hoặc Apple có email đã xác minh trùng với email này.",
		ineligibleWrongAccount:
			"Lời mời gửi cho {email}. Hãy đăng nhập bằng tài khoản được mời, hoặc liên kết Google, GitHub hoặc Apple có email đã xác minh trùng với email này (với Apple, chọn chia sẻ email thay vì ẩn email).",
		accept: "Tham gia",
	},
	switchAccount: {
		action: "Đăng nhập tài khoản khác",
		hint: "Bạn sẽ được đăng xuất. Đăng nhập lại bằng tài khoản được mời rồi mở lại link này.",
	},
	errors: {
		rateLimited: "Bạn đã mở quá nhiều link mời. Hãy thử lại sau ít phút.",
		conflict: "Lời mời vừa thay đổi. Hãy thử lại.",
		fallback: "Không mở được lời mời. Hãy thử lại sau.",
	},
};
