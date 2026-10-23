import type { Messages } from "../../message-types";

export const liveMockSync: Messages["liveMockSync"] = {
	badge: {
		label: "Đồng bộ với mock",
		title: "Live Mock Sync với {name}",
		project: "Live Mock Sync",
	},
	settings: {
		title: "Live Mock Sync · {name}",
		toggle: "Đồng bộ từ mock",
		toggleHint:
			"Một chiều, mock → collection. Tắt thì collection thành collection thường và giữ nguyên nội dung.",
		project: "Mock project",
		projectHidden: "Mock project đã bị xoá, hoặc bạn không mở được.",
		environment: "Environment",
		environmentHint:
			"Live Mock Sync quản lý baseUrl và biến id của mỗi resource trong đó.",
		noEnvironment: "Không kèm environment",
		lastSynced: "Đồng bộ lần cuối {time}",
		behaviour:
			"Phần bạn tự sửa (header, body, script) được giữ. Mock đổi trúng chỗ đó thì bạn chọn. Request bị gỡ khỏi mock chuyển vào folder _removed.",
		needEditor:
			"Chỉ Editor của cả project mock lẫn collection mới bật hoặc tắt đồng bộ.",
		urlChanged:
			"Secret của project mock đã đổi. Live Mock Sync không chép URL mock mới vào environment dùng chung; hãy tự cập nhật baseUrl nếu mọi người ở đây được dùng nó.",
		save: "Lưu",
		stopped:
			"Đã tắt đồng bộ. {name} giờ là collection thường, nội dung giữ nguyên.",
	},
	banner: {
		title: "Mock đã đổi field bạn đã sửa",
		count: { other: "{count} xung đột đang chờ bạn chọn." },
		resolve: "Xem và chọn",
	},
	conflicts: {
		title: "Thay đổi từ {name}",
		intro: "Chọn giữ bản nào ở mỗi chỗ mock đổi trúng phần bạn đã sửa.",
		sides:
			"Lấy từ mock dùng giá trị của mock; Giữ bản của tôi giữ giá trị của bạn.",
		keepMock: "Lấy từ mock",
		keepMine: "Giữ bản của tôi",
		allMock: "Lấy tất cả từ mock",
		allMine: "Giữ tất cả bản của tôi",
		submit: "Áp dụng",
		done: "Đã áp dụng thay đổi từ {name}",
		nothing: "Không có gì đang chờ: collection đã theo đúng mock.",
		loading: "Đang so với mock…",
	},
	project: {
		create: "Tạo collection đồng bộ",
		open: "Mở collection đồng bộ",
		created: "Đã tạo {name}, đồng bộ với mock này",
		noWorkspace: "Hãy chọn một workspace trong API client trước.",
	},
	names: {
		removedFolder: "Các request mock không còn phục vụ. Xoá khi không cần nữa.",
		removedItem: "Đã gỡ khỏi mock.",
		environment: "{name} (mock)",
	},
};
