import type { Messages } from "../../message-types";

export const apiClientToolsImport: Messages["apiClientTools"]["import"] = {
	title: "Import",
	intro:
		"Dán lệnh cURL, Collection v2.1, file environment (v2.1) hoặc tài liệu OpenAPI 3.x dạng JSON, hoặc chọn file.",
	text: "Nội dung cần import",
	placeholder: "curl -X GET 'https://api.example.com/users'",
	chooseFile: "Chọn file",
	fileChosen: "{name} ({size})",
	removeFile: "Bỏ {name}",
	reading: "Đang đọc file…",
	readFailed: "Không đọc được file. Hãy chọn lại.",
	idle: "Chưa có gì để import.",
	detecting: "Đang kiểm tra định dạng…",
	detected: {
		other: "Nhận dạng {format}: {count} request.",
	},
	detectedEnvironment: {
		other: "Nhận dạng file environment: {count} biến.",
	},
	formats: {
		curl: "cURL",
		"collection-v21": "Collection v2.1",
		openapi: "OpenAPI 3.x",
	},
	errors: {
		INPUT_TOO_LARGE: "Nội dung lớn hơn {max}. Hãy chia thành các file nhỏ hơn.",
		EMPTY_INPUT: "Chưa có gì để import. Dán nội dung hoặc chọn file.",
		INVALID_JSON:
			"Nội dung không phải JSON hợp lệ hay lệnh cURL. Kiểm tra lại rồi thử lại.",
		YAML_NOT_SUPPORTED:
			"Chưa hỗ trợ YAML. Hãy chuyển tài liệu sang JSON rồi import.",
		UNKNOWN_FORMAT:
			"Không nhận dạng được định dạng. Hãy dùng cURL, Collection v2.1, file environment hoặc OpenAPI 3.x dạng JSON.",
		UNSUPPORTED_VERSION:
			"Chưa hỗ trợ {version}. Hãy dùng Collection v2.1 hoặc OpenAPI 3.x.",
		INVALID_CURL: "Lệnh cURL này không có URL để gọi.",
		UNTERMINATED_QUOTE:
			"Một dấu nháy trong lệnh cURL chưa được đóng. Kiểm tra dấu nháy rồi thử lại.",
		INVALID_DOCUMENT:
			"Tài liệu sai cấu trúc ở {path}. Kiểm tra file rồi thử lại.",
		TOO_COMPLEX: "Tài liệu lồng quá sâu hoặc quá lớn để import.",
	},
	warningsTitle: {
		other: "{count} lưu ý về lần import này",
	},
	warnings: {
		UNSUPPORTED_OPTION:
			"Tuỳ chọn cURL {option} không có tương đương nên đã bỏ qua.",
		UNSUPPORTED_AUTH: "Chưa hỗ trợ kiểu auth {type}; đã đặt thành không auth.",
		UNSUPPORTED_BODY: "Chưa hỗ trợ kiểu body {mode}; để trống.",
		UNSUPPORTED_METHOD: "Chưa hỗ trợ method {method}; dùng GET.",
		FILE_NOT_INCLUDED:
			"File {name} không có trong nội dung import. Hãy chọn lại.",
		SCRIPT_REVIEW:
			"Có script dùng API của công cụ khác. Script ở đây dùng <code>lm.*</code>; hãy xem lại.",
		TRUNCATED: "Chỉ {max} mục đầu được import.",
		EXTRA_URLS: "Lệnh có thêm {count} URL; chỉ dùng URL đầu tiên.",
		UNRESOLVED_REF: "Không phân giải được tham chiếu {ref} nên đã bỏ qua.",
		EXAMPLE_BODY_TRUNCATED:
			"Body của một example đã bị cắt cho vừa giới hạn dung lượng.",
		INVALID_METADATA: {
			tags: "Tag của collection không hợp lệ nên đã bị bỏ qua.",
			status: "Trạng thái của collection không hợp lệ nên đã bị bỏ qua.",
		},
		TEXT_TRUNCATED: "Một giá trị đã bị cắt còn {max} ký tự.",
		MORE_WARNINGS: "Còn {count} lưu ý khác không liệt kê.",
	},
	picker: {
		legend: "Request cần mở",
		selectAll: "Chọn tất cả",
		selectNone: "Bỏ chọn",
		selected: "Đã chọn {count}/{total}",
		capped: "Mỗi lần mở được tối đa {max} tab.",
	},
	submitRequests: {
		other: "Mở {count} request",
	},
	submitEnvironment: "Import environment",
	export: {
		trigger: "Export",
		label: "Export các request đang mở",
		collection: "Collection v2.1 (.json)",
		openapi: "OpenAPI 3.0 (.json)",
		environment: "Environment (.json)",
		downloaded: "Đã tải {file}.",
		skipped: {
			other:
				"{count} request bị bỏ qua vì trùng method và path với request khác.",
		},
		secretsBlank: "Giá trị secret được để trống trong file.",
		nothing: "Mở một request để export.",
		defaultName: "Request Localman",
	},
};
