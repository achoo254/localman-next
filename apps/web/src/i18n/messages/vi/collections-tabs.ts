import type { Messages } from "../../message-types";

type Tabs = Pick<
	Messages["collections"],
	"page" | "save" | "breadcrumb" | "inherit" | "send"
>;

export const collectionsTabs: Tabs = {
	page: {
		kind: {
			collection: "Collection",
			folder: "Folder",
			example: "Example",
		},
		sharedWithYou: "Được chia sẻ với bạn",
		nameLabel: {
			collection: "Tên collection",
			folder: "Tên folder",
			example: "Tên example",
		},
		loadFailed: "Không tải được collection này.",
		folderGone: "Folder này không còn nữa. Hãy đóng tab của nó.",
		share: "Chia sẻ",
		readOnly: "Bạn chỉ xem được collection này. Hãy nhờ Editor chỉnh sửa.",
		tabs: {
			label: "Các phần của collection",
			overview: "Tổng quan",
			authorization: "Authorization",
			scripts: "Script",
			variables: "Biến",
		},
		status: {
			saving: "Đang lưu…",
			saved: "Đã lưu mọi thay đổi",
			error: "Chưa lưu được: {message}",
		},
		overview: {
			description: "Mô tả",
			edit: "Sửa",
			save: "Lưu",
			inputLabel: "Mô tả bằng Markdown",
			hint: "Markdown: tiêu đề, danh sách, **đậm**, *nghiêng*, `code` và link.",
			empty: "Chưa có mô tả.",
			details: "Thông tin",
			createdBy: "Người tạo",
			you: "Bạn",
			member: "Một thành viên workspace",
			updated: "Cập nhật lần cuối",
			updatedBy: "{time}, bởi {name}",
			workspace: "Workspace",
			requests: "Request",
		},
		auth: {
			note: "Các request chọn Kế thừa auth từ cấp trên sẽ dùng auth này.",
			folderInherit:
				"Folder này dùng auth của folder cha, hoặc của collection.",
		},
		scripts: {
			order:
				"Khi gửi, script chạy theo thứ tự: collection, rồi các folder từ ngoài vào trong, rồi request.",
		},
		variables: {
			caption: "Biến của collection",
			hint: "Dùng chúng dưới dạng <code>{example}</code> trong các request của collection này. Giá trị secret được ẩn và để trống khi export.",
			secret: "Secret",
			enable: "Dùng {name}",
			keyOf: "Key của dòng {n}",
			valueOf: "Giá trị của {name}",
			markSecret: "Ẩn giá trị của {name}",
			remove: "Xoá {name}",
			add: "Thêm biến",
			empty: "Chưa có biến nào.",
		},
	},
	save: {
		title: "Lưu vào collection",
		name: "Tên request",
		collection: "Collection",
		folder: "Folder",
		top: "Cấp ngoài cùng",
		submit: "Lưu",
		saved: "Đã lưu {name} vào {collection}.",
		noCollection:
			"Workspace này chưa có collection nào bạn sửa được. Hãy tạo một collection trước.",
		button: "Lưu",
		buttonLabel: "Lưu vào collection",
		goneTitle: "Giữ thành request rời",
		gone: "Request trong collection không còn nữa nên tab này không còn gắn với nó. Nội dung bạn sửa vẫn còn đây.",
	},
	breadcrumb: {
		label: "Đường dẫn trong collection",
	},
	inherit: {
		loading: "Đang tìm nguồn auth…",
		fromFolder: "Kế thừa từ folder <link>{name}</link>",
		fromCollection: "Kế thừa từ collection <link>{name}</link>",
		failed: "Không đọc được collection của request: {reason}",
		gone: "Request này không còn trong collection nên không có auth cấp trên.",
	},
	send: {
		unavailable:
			"Chưa gửi: không đọc được collection của request ({reason}). Nếu gửi sẽ thiếu auth và script của nó.",
		gone: "request không còn trong collection",
	},
};
