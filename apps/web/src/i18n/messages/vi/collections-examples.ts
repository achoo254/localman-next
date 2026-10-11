import type { Messages } from "../../message-types";

type Part = Pick<Messages["collections"], "example" | "bulk">;

export const collectionsExamples: Part = {
	example: {
		response: "Response",
		status: "Status",
		statusInvalid: "Dùng status từ 100 đến 599.",
		statusText: "Status text",
		language: "Ngôn ngữ của body",
		headers: "Header của response",
		addHeader: "Thêm header",
		body: "Body của response",
		note: "Example là một response đã lưu của request này. Nó dùng để mô tả request; khi gửi không dùng tới nó.",
		gone: "Example này không còn nữa. Hãy đóng tab của nó.",
		cut: "Body quá dài nên đã bị cắt cho vừa trước khi lưu.",
		saveFromResponse: "Lưu thành example",
		saved: "Đã lưu example {name}.",
	},
	bulk: {
		selected: {
			other: "Đã chọn {count}",
		},
		clear: "Bỏ chọn",
		delete: "Xoá",
		bar: "Các mục đã chọn",
		title: "Xoá các mục đã chọn",
		collections: {
			other: "{count} collection sẽ vào thùng rác.",
		},
		nodes: {
			other: "{count} folder, request hoặc example bị xoá vĩnh viễn.",
		},
		confirm: "Xoá",
		done: {
			other: "Đã xoá {count} mục.",
		},
		partial: "Đã xoá {done}/{total} mục. {reason}",
	},
};
