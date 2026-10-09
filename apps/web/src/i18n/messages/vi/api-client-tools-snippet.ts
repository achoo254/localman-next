import type { Messages } from "../../message-types";

export const apiClientToolsSnippet: Messages["apiClientTools"]["snippet"] = {
	title: "Code snippet",
	language: "Ngôn ngữ",
	resolved:
		"Biến đã được thay bằng giá trị hiện tại. Kiểm tra code trước khi chia sẻ.",
	secrets: "Code chứa giá trị của biến secret {names} ở dạng plaintext.",
	unresolved: "Các biến chưa có giá trị nên giữ nguyên: {names}.",
	bodyOmitted:
		"Body là file nên không có trong code. Hãy tự đính kèm file trong code của bạn.",
	failed: "Không sinh được code cho request này.",
};
