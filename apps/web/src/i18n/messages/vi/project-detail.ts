import type { Messages } from "../../message-types";

export const projectDetail: Messages["projectDetail"] = {
	loading: "Đang tải project…",
	loadFailed: "Không tải được project",
	missing: {
		title: "Không tìm thấy project",
		body: "Project có thể đã bị xoá hoặc bạn không có quyền truy cập.",
		back: "Về danh sách projects",
	},
	header: {
		collaborators: "Cộng tác viên",
		collaboratorsCount: "Cộng tác viên · {count}",
	},
	endpoint: {
		secretTip:
			"Mã bí mật của project. Ai có mã này đều gọi được API, đừng chia sẻ công khai.",
		prefixTip: "API prefix. Đổi trong Sửa project.",
		resourceTip:
			"Tên resource, ví dụ users. Mỗi resource có đủ GET, POST, PUT, DELETE.",
		generateAll: "Sinh tất cả",
		resetAll: "Reset tất cả",
	},
	addResource: "Thêm resource",
	resources: {
		loading: "Đang tải resource…",
		loadFailed: "Không tải được resource",
		empty:
			"Chưa có resource nào. Resource là một bảng dữ liệu có endpoint CRUD riêng.",
		count: { other: "{count} resource" },
	},
	planLimit: "Project đã đạt giới hạn resource của chủ project.",
	toast: {
		created: "Đã tạo resource <code>{name}</code>.",
		imported: {
			other: "Đã nhập <code>{name}</code> với <b>{count}</b> bản ghi.",
		},
		importedEmpty: "Đã nhập <code>{name}</code>.",
		importedRelated: {
			other: "Đã nhập <code>{name}</code> và {count} resource liên quan.",
		},
		createdHint: "Bấm vào thanh xám để sinh dữ liệu.",
		updated: "Đã cập nhật resource <code>{name}</code>.",
		deleted: "Đã xoá resource <code>{name}</code>.",
		dataUpdated: "Đã cập nhật dữ liệu",
		recordsFor: { other: "<b>{count}</b> bản ghi cho <code>{name}</code>." },
		generated: "Đã sinh dữ liệu",
		reset: "Đã reset dữ liệu",
		noRecords: "<code>{name}</code> không còn bản ghi nào.",
		generatedAll: { other: "<b>{count}</b> resource có dữ liệu mới." },
		nested: "Đã lồng <code>{name}</code> vào <code>{target}</code>.",
		movedToRoot: "Đã đưa <code>{name}</code> về root.",
		oldDataReset: "Dữ liệu cũ đã được reset.",
	},
	generate: {
		title: "Sinh dữ liệu",
		question: { other: "Sinh {count} bản ghi cho “{name}”?" },
		clearTitle: "Xoá dữ liệu",
		clearQuestion: "Xoá mọi bản ghi của “{name}”?",
	},
	generateAll: {
		empty: "Project chưa có resource nào.",
		question: "Thay dữ liệu đang có?",
		lead: "Các resource sau đã có dữ liệu và sẽ được sinh lại:",
		summary: "{resources}, {records}",
		details: "Xem từng resource",
	},
	resetAll: {
		nothing: "Chưa có dữ liệu nào để reset.",
		question: "Xoá toàn bộ bản ghi?",
		lead: "Mọi resource về 0 bản ghi, schema và endpoint được giữ nguyên:",
		confirm: "Reset dữ liệu",
	},
	move: {
		title: "Di chuyển resource",
		nestQuestion: "Lồng “{name}” vào “{target}”?",
		rootQuestion: "Đưa “{name}” về root?",
		lead: "Dữ liệu sau thuộc về resource cha cũ nên sẽ bị reset:",
		confirm: "Di chuyển",
	},
};
