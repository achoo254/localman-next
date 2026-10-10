import type { Messages } from "../../message-types";

export const resourceTree: Messages["resourceTree"] = {
	rail: {
		addToRoot: "Thêm vào root",
	},
	tree: {
		label: "Cây resource",
	},
	zoom: {
		label: "Thu phóng",
		fit: "Vừa khung",
		fitHint: "Thu cả cây cho vừa khung (Shift+1)",
		actualHint: "Kích thước thật (Shift+0)",
	},
	hint: {
		idle: "Bấm chấm tròn bên trái một resource để chọn, sau đó bấm chấm tròn bên phải của resource khác để lồng vào.",
		selected:
			"Đang chọn <b>{name}</b>. Bấm chấm tròn bên phải resource đích để lồng vào, hoặc bấm thanh “Thêm vào root”. Nhấn Esc để huỷ.",
	},
	connector: {
		select: "Chọn {name} để di chuyển",
		nest: "Lồng {moving} vào {target}",
		selectedFallback: "resource đang chọn",
	},
	node: {
		open: "Mở {url}",
		edit: "Sửa",
		editLabel: "Sửa {name}",
		data: "Dữ liệu",
		dataLabel: "Dữ liệu {name}",
		delete: "Xoá",
		deleteLabel: "Xoá {name}",
		moreLabel: "Thao tác khác cho {name}",
	},
	generator: {
		label: "Số bản ghi của {name}",
		value: { other: "{count} bản ghi" },
		valueBlocked: { other: "{count} bản ghi. {reason}" },
		blockedReason: "Sinh dữ liệu cho {parent} trước.",
		blockedToast: "Cần sinh dữ liệu cho {parent} trước khi sinh cho {name}.",
		parentFallback: "resource cha",
	},
	refuse: {
		selectFirst: "Chọn một resource trước: bấm chấm tròn bên trái resource đó.",
		missing: "Resource không còn tồn tại. Tải lại trang để cập nhật cây.",
		self: "Không thể lồng {moving} vào chính nó.",
		alreadyRoot: "{moving} đã ở root.",
		alreadyIn: "{moving} đã nằm trong {target}.",
		cycle: "Không thể lồng {moving} vào {target} vì sẽ tạo vòng lặp.",
		nameTaken: "Đã có resource tên {moving} ở vị trí này.",
		tooDeep: "Cây resource chỉ lồng được tối đa {max} cấp.",
	},
};
