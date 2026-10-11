import type { Messages } from "../../message-types";

export const collectionsTrash: Messages["collections"]["trash"] = {
	pageTitle: "Thùng rác",
	title: "Thùng rác",
	retention: {
		other:
			"Collection đã xoá được giữ {count} ngày, sau đó tự động bị xoá vĩnh viễn.",
	},
	back: "Workbench",
	search: "Tìm theo tên",
	searchPlaceholder: "Tìm theo tên",
	table: "Collection đã xoá",
	columns: {
		name: "Tên",
		type: "Loại",
		workspace: "Workspace",
		deletedBy: "Người xoá",
		deletedAt: "Ngày xoá",
		daysLeft: "Còn lại",
		actions: "Thao tác",
	},
	items: {
		other: "{count} request",
	},
	filters: {
		label: "Bộ lọc",
		workspace: "Workspace",
		allWorkspaces: "Mọi workspace",
		deletedBy: "Người xoá",
		everyone: "Mọi người",
	},
	typeCollection: "collection",
	deletedWorkspace: "Workspace đã xoá",
	removedAccount: "Tài khoản đã xoá",
	daysLeft: {
		other: "{count} ngày",
	},
	restore: "Khôi phục",
	restoreLabel: "Khôi phục {name}",
	deletePermanently: "Xoá vĩnh viễn",
	deleteLabel: "Xoá vĩnh viễn {name}",
	emptyTitle: "Thùng rác trống",
	emptyBody: "Collection bạn xoá sẽ nằm ở đây một thời gian để bạn khôi phục.",
	noMatch: "Không có gì khớp với “{query}”.",
	noFilterMatch: "Không có collection đã xoá nào khớp với bộ lọc.",
	loading: "Đang tải thùng rác…",
	loadFailed: "Không tải được thùng rác.",
	restoreModal: {
		title: "Khôi phục “{name}”",
		workspace: "Khôi phục vào workspace",
		noWorkspace: "Bạn không thêm được collection vào workspace nào của mình.",
		submit: "Khôi phục",
	},
	purge: {
		title: "Xoá vĩnh viễn",
		question: "Xoá hẳn “{name}”?",
		body: "Folder và request của nó cũng bị xoá. Không hoàn tác được.",
		confirm: "Xoá vĩnh viễn",
	},
	toast: {
		restored: "Đã khôi phục {name} vào {workspace}.",
		purged: "Đã xoá vĩnh viễn {name}.",
	},
};
