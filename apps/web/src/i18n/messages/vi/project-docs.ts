import type { Messages } from "../../message-types";

export const projectDocs: Messages["projectDocs"] = {
	publish: {
		button: "Docs",
		title: "Docs public",
		intro:
			"Docs về resource, field và endpoint của project này, luôn đúng như hiện tại. Ai có link cũng đọc được mà không cần đăng nhập.",
		toggle: "Xuất bản docs",
		toggleHint:
			"Docs không chứa URL mock: path bắt đầu từ {baseUrl}, bạn tự chia sẻ URL đó. Tắt đi thì link không dùng được nữa.",
		link: "Link tới docs",
	},
	page: {
		pageTitle: "Docs API",
		badge: "Sinh từ mock",
		intro:
			"Docs này theo đúng resource hiện tại của mock. Path bắt đầu từ base URL của mock, do chủ project chia sẻ với bạn.",
		endpoints: "Endpoint",
		fields: "Field",
		field: "Field",
		type: "Kiểu",
		detail: "Chi tiết",
		example: "Bản ghi mẫu",
		empty: "Project này chưa có resource nào.",
		notFoundTitle: "Docs này không được xuất bản",
		notFoundText: "Link sai, hoặc project đã gỡ docs xuống.",
	},
};
