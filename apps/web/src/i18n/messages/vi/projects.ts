import type { Messages } from "../../message-types";

export const projects: Messages["projects"] = {
	title: "Projects",
	add: "Tạo project mới",
	list: {
		loading: "Đang tải danh sách project…",
		loadFailed: "Không tải được danh sách project",
		emptyTitle: "Chưa có project nào",
		emptyBody:
			"Project chứa các resource và endpoint mock của bạn. Tạo project đầu tiên để bắt đầu.",
		create: "Tạo project",
	},
	row: {
		invited: "Được mời",
		ownedBy: "Project của {owner}",
		ownerFallback: "người khác",
		collaborators: { other: "{count} cộng tác viên" },
		resources: { other: "{count} resource" },
		records: { other: "{count} bản ghi" },
	},
	menu: {
		trigger: "Tuỳ chọn cho {name}",
		collaborators: "Cộng tác viên",
		clone: "Nhân bản",
		edit: "Sửa",
		delete: "Xoá",
	},
	form: {
		titleNew: "Project mới",
		titleEdit: "Sửa project",
		create: "Tạo project",
		save: "Lưu thay đổi",
		nameLabel: "Tên project",
		prefixHint:
			"Thêm vào trước mọi endpoint, ví dụ <code>/api/v1</code>. Để trống nếu không cần. Chỉ dùng chữ, số, <code>-</code>, <code>_</code> và <code>/</code>.",
		preview: "Xem trước",
	},
	validation: {
		nameRequired: "Nhập tên project.",
		nameTooLong: "Tên tối đa {max} ký tự.",
		nameStart: "Tên phải bắt đầu bằng chữ hoặc số.",
		namePattern:
			"Tên chỉ gồm chữ, số, khoảng trắng và các ký tự - _ ( ) . · , & + ' :",
		prefixTooLong: "Prefix tối đa {max} ký tự.",
		prefixPattern: "Prefix chỉ gồm chữ không dấu, số, -, _ và /.",
	},
	toast: {
		created: "Đã tạo project {name}.",
		updated: "Đã cập nhật project {name}.",
		cloned: "Đã nhân bản thành {name}.",
		deleted: "Đã xoá project {name}.",
		open: "Mở project",
	},
	delete: {
		title: "Xoá project",
		question: "Xoá “<code>{name}</code>”?",
		confirm: "Xoá project",
		checking: "Đang kiểm tra dữ liệu liên quan…",
		summary: "Sẽ xoá kèm {items}.",
		separator: ", ",
		irreversible:
			"Toàn bộ dữ liệu sẽ bị xoá. Hành động này không thể hoàn tác.",
		kinds: {
			resources: { other: "{count} resource" },
			records: { other: "{count} bản ghi dữ liệu" },
			collaborators: { other: "{count} cộng tác viên" },
			mcpTokens: { other: "{count} token MCP" },
			requestLogs: { other: "{count} dòng request log" },
			webhookInboxes: { other: "{count} webhook inbox" },
			callbacks: { other: "{count} callback" },
		},
	},
	rotate: {
		title: "Đổi URL mock",
		question: "Đổi URL mock của {name}?",
		confirm: "Đổi URL",
		checking: "Đang kiểm tra cộng tác viên…",
		noCollaborators: "Project chưa có cộng tác viên nào.",
		notify: { other: "{count} cộng tác viên sẽ nhận thông báo kèm URL mới." },
		oldStops:
			"URL cũ ngừng hoạt động ngay. Frontend hoặc tool đang gọi URL cũ phải cập nhật sang URL mới.",
		mcp: "URL MCP cũng đổi theo; agent đã thêm URL cũ phải thêm lại.",
		done: "Đã đổi URL mock",
		doneHint: "Cập nhật URL mới ở frontend và tool đang dùng.",
	},
};
