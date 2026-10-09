import type { Messages } from "../../message-types";

export const apiClientOpen: Messages["apiClientOpen"] = {
	node: {
		label: "API Client",
		aria: "Mở {name} trong API Client",
	},
	project: {
		open: "Mở trong API Client",
	},
	fromMock: {
		button: "Từ project mock",
		title: "Mở project mock",
		intro:
			"Mỗi endpoint đang bật của từng resource mở thành một tab: list, get, create, update và delete, kể cả resource lồng nhau. Id bản ghi thành biến như <code>{example}</code>.",
		legend: "Project mock",
		loading: "Đang tải danh sách project…",
		loadFailed: "Không tải được danh sách project.",
		empty:
			"Bạn chưa có project mock nào. Hãy tạo một project ở mục Projects trước.",
		submit: "Mở request",
	},
	names: {
		list: "Liệt kê {name}",
		get: "Lấy một bản ghi {name}",
		create: "Tạo trong {name}",
		update: "Thay thế trong {name}",
		patch: "Cập nhật trong {name}",
		delete: "Xoá khỏi {name}",
	},
	toast: {
		loadFailed: "Không mở được project mock",
		resourceMissing:
			"Resource này không còn trong project. Hãy tải lại trang project rồi thử lại.",
		noEndpoints: "Project này chưa có endpoint nào đang bật.",
		truncated: "Đã mở {opened} trên {total} request",
		truncatedBody:
			"Chỉ giữ được tối đa {max} tab. Hãy đóng bớt tab rồi mở lại project để mở phần còn lại.",
		full: "Không còn chỗ mở tab",
		fullBody: "Chỉ giữ được tối đa {max} tab. Hãy đóng bớt tab trước.",
	},
};
