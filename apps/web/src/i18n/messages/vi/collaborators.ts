import type { Messages } from "../../message-types";

export const collaborators: Messages["collaborators"] = {
	modal: {
		title: "Cộng tác viên · {project}",
		done: "Xong",
		leave: "Rời project",
	},
	list: {
		label: "Danh sách cộng tác viên",
		loading: "Đang tải thành viên…",
		loadFailed: "Không tải được danh sách thành viên",
	},
	row: {
		owner: "Owner",
		you: "Bạn",
		emailUnverified: "email chưa xác minh",
		status: {
			accepted: "Đã tham gia",
			pending: "Đang chờ",
			expired: "Hết hạn",
		},
		personExpired: "{person} · đã hết hạn {date}",
		linkPending: "Link mời · {email} · hết hạn {date}",
		linkExpired: "Link mời · {email} · đã hết hạn {date}",
		emailHidden: "email đã ẩn",
		remove: "Xoá {label} khỏi project",
		cancelInvite: "Huỷ lời mời {label}",
		deleteInvite: "Xoá lời mời {label}",
	},
	toast: {
		inviteCancelled: "Đã huỷ lời mời {label}",
		left: "Đã rời {project}",
		removed: "Đã xoá {name} khỏi project",
	},
	seats: {
		count: "{seats} thành viên (tính cả owner và lời mời đang chờ)",
		full: { other: "Đã đủ {count} thành viên" },
		removeToInvite: "Xoá bớt thành viên hoặc lời mời để mời thêm.",
	},
	form: {
		legend: "Mời cộng tác viên",
		label: "Username hoặc email",
		hint: "Người chưa có tài khoản hoandat: nhập email để tạo link mời dùng 1 lần (7 ngày).",
		placeholder: "@username hoặc ten@example.com",
		submit: "Mời",
		empty: "Nhập username hoặc email.",
		linkLabel: "Link mời cho {who}",
		linkHint: "Hết hạn {date}. Link chỉ hiện lần này.",
		linkHintNoDate: "Link chỉ hiện lần này.",
		invited: "Đã mời {who}",
		linkCreated: "Đã tạo link mời cho {who}",
		notified: "Họ thấy lời mời trong app và qua kênh thông báo đã bật.",
	},
	invitee: {
		confirm: "Xác nhận mời",
		createLink: "Tạo link mời",
		noAccount:
			"Chưa có tài khoản dùng <b>{email}</b>. Tạo link mời dùng 1 lần (7 ngày) gắn với email này rồi tự gửi cho họ.",
		unverifiedWarning:
			"Tài khoản này chưa xác minh email — chỉ mời nếu bạn nhận ra người này.",
	},
	confirm: {
		removeTitle: "Xoá cộng tác viên",
		removeQuestion: "Xoá {name} khỏi {project}?",
		removeAction: "Xoá khỏi project",
		removeBody:
			"Họ sẽ mất quyền truy cập project ngay và không tham gia lại được bằng magic link. Muốn họ quay lại, hãy gửi lời mời mới.",
		leaveTitle: "Rời project",
		leaveQuestion: "Rời {project}?",
		leaveAction: "Rời project",
		leaveBody: "Bạn sẽ mất quyền truy cập cho tới khi được mời lại.",
	},
	rotate: {
		hint: "Người này vẫn biết URL mock. Đổi URL để chặn hẳn.",
		action: "Đổi URL mock",
		done: "Đã đổi URL mock. URL cũ không còn dùng được.",
	},
	magic: {
		title: "Magic link · {project}",
		lead: "Ai đã đăng nhập và mở link này sẽ tham gia <b>{project}</b> với vai trò cộng tác viên. Link dùng được nhiều lần, hết hạn sau 7 ngày. Bạn có thể tạo link mới hoặc thu hồi bất cứ lúc nào.",
		full: "Project đã đủ {used}/{max} thành viên. Người mở link sẽ không tham gia được cho tới khi bạn xoá bớt thành viên.",
		loading: "Đang tải trạng thái link…",
		shownOnce: "Link chỉ hiện lần này. Hãy sao chép trước khi đóng.",
		expires: "Hết hạn {date}.",
		copy: "Sao chép link",
		create: "Tạo magic link",
		regenerate: "Tạo link mới",
		regenerateQuestion: "Tạo magic link mới?",
		regenerateBody:
			"Link cũ ngừng hoạt động ngay. Người đã tham gia vẫn giữ quyền.",
		revokeTitle: "Thu hồi magic link",
		revokeQuestion: "Thu hồi magic link?",
		revoke: "Thu hồi",
		revokeBody:
			"Người mở link sẽ không tham gia được nữa. Người đã tham gia vẫn giữ quyền.",
		revoked: "Đã thu hồi magic link",
		none: "Chưa có magic link đang hoạt động.",
		active: "Đang hoạt động",
		expired: "Đã hết hạn",
		expiresOn: "Hết hạn {date}",
		createdOn: "· Tạo lúc {date}",
		hiddenNote:
			"Vì lý do bảo mật, link không hiển thị lại. Tạo link mới nếu cần gửi lại.",
	},
	errors: {
		notFound: "Không tìm thấy tài khoản với username hoặc email này.",
		alreadyMember: "Người này đã có trong project.",
		ambiguousUsername:
			"Có nhiều tài khoản dùng username này. Hãy mời bằng email.",
		invalid: "Nhập username hoặc email hợp lệ.",
		rateLimited:
			"Bạn đã tra cứu hoặc mời quá nhiều lần. Hãy thử lại sau ít phút.",
		full: "Project đã hết chỗ. Hãy xoá bớt thành viên hoặc huỷ một lời mời trước.",
		conflict: "Danh sách thành viên vừa thay đổi. Hãy thử lại.",
		fallback: "Không mời được lúc này. Hãy thử lại sau.",
	},
};
