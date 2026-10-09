/**
 * User-facing text of the MCP tab, in one place for translation. Text
 * between backticks renders as `<code>` (see `CodeSpans`).
 */
import type { MockToolAction } from "@localman/shared/constants";
import type { McpConfigFormat } from "./mcp-snippets";

export const MCP_COPY = {
	tabRest: "REST",
	tabMcp: "MCP",
	tabListLabel: "Endpoint của mock",
	title: "MCP endpoint",
	transport: "Streamable HTTP",
	urlLabel: "URL MCP",
	urlItem: "URL",
	urlHint:
		"Tool thao tác trên chính dữ liệu có trạng thái của mock: tạo qua MCP thì GET REST thấy ngay. Mỗi lần gọi tool tính 1 request tới mock.",
	configTitle: "Cấu hình cho agent",
	configLegend: "Định dạng cấu hình",
	configHintOff: "Không cần token: ai biết URL MCP đều gọi được, giống REST.",
	configHintOn: (env: string) =>
		`Cấu hình đọc token từ biến môi trường \`${env}\`. Đặt biến này trước khi chạy lệnh hoặc mở lại editor.`,
	/** Under every terminal command that reads the token variable. */
	shellHint: (env: string) =>
		`Lệnh terminal viết cho bash/zsh (\`$${env}\`). Trên PowerShell đổi thành \`$env:${env}\`, trên cmd thành \`%${env}%\`.`,
	configHintUnknown:
		"Nếu project yêu cầu token cho MCP, hỏi chủ project để lấy token rồi thêm header `Authorization: Bearer …`.",
	tokenTitle: "Yêu cầu token cho MCP",
	tokenLoading: "Đang tải cài đặt token…",
	tokenLoadFailed: "Không tải được cài đặt token",
	retry: "Thử lại",
	tokenHelpOff:
		"Mặc định giống REST: ai biết URL MCP đều gọi được. Bật để bắt buộc Bearer token riêng của project, dùng được ở mọi gói.",
	tokenHelpOn:
		"Gọi thiếu header `Authorization: Bearer …` nhận 401. Token chỉ hiện một lần lúc tạo; mất token thì xoay token mới.",
	tokenHint: (last4: string, created: string) =>
		`Token lmmcp_…${last4} · tạo ${created}`,
	rotate: "Xoay token",
	collaboratorNote:
		"Chủ project quản lý token MCP. Nếu MCP đang yêu cầu token, hỏi chủ project để lấy token.",
	revealTitle: "Lưu token ngay",
	revealLabel: "Token MCP",
	revealItem: "token",
	revealHint: (env: string) =>
		`Token chỉ hiện lần này, Localman không lưu bản đọc được. Đặt vào biến \`${env}\` để các cấu hình bên trên dùng được.`,
	revealDismiss: "Đã lưu token",
	toolsTitle: "Tool tự sinh",
	toolsCountUnit: " tool",
	toolsEmpty:
		"Chưa có tool. Thêm resource để có `list_`, `get_`, `create_`, `update_` và `delete_` cho resource đó.",
	toolsAllOff:
		"Mọi endpoint đang tắt nên chưa có tool nào. Bật endpoint trong Sửa resource.",
	toolsFootnote:
		"Endpoint đang tắt thì không sinh tool. MCP resources: `mock://schema`, `mock://openapi`.",
	readOnly: "chỉ đọc",
	destructive: "phá huỷ",
	tryButton: "Thử",
	tryIntro:
		"MCP Inspector là công cụ mã nguồn mở của dự án MCP, chạy trên máy bạn qua Node.js. Chạy lệnh dưới đây trong terminal: Inspector mở giao diện trong trình duyệt để bạn kết nối và gọi thử từng tool.",
	tryCommandCaption: "Inspector",
	tryCliCaption: "Kiểm nhanh trong terminal",
	tryQuota: "Mỗi lần gọi tool tính 1 request vào hạn mức mock của bạn.",
	tryDocs: "Tài liệu MCP Inspector",
	newTab: ", mở ở tab mới",
} as const;

export const MCP_CONFIG_LABELS: Readonly<
	Record<McpConfigFormat, { label: string; caption: string }>
> = {
	claude: { label: "Claude Code", caption: "Terminal" },
	cursor: { label: "Cursor", caption: ".cursor/mcp.json" },
	json: { label: "JSON chung", caption: "mcp.json" },
};

/** Arguments of each tool; a child resource adds `parentId` first. */
export const MCP_TOOL_PARAMS: Readonly<Record<MockToolAction, string>> = {
	list: "search, filter, page, limit, sortBy, order",
	get: "id",
	create: "body theo schema",
	update: "id, body",
	delete: "id",
};

export const MCP_PARENT_PARAM = "parentId, ";

/** Confirmation dialogs of the token setting. */
export const MCP_TOKEN_DIALOG_COPY = {
	enable: {
		title: "Bật token cho MCP",
		question: (project: string) => `Bật yêu cầu token cho ${project}?`,
		body: "Agent đang gọi MCP mà không kèm token sẽ nhận 401 ngay.",
		bodyNew: "Token mới chỉ hiện một lần sau bước này.",
		bodyKept: (last4: string) =>
			`Token đã tạo trước đây (lmmcp_…${last4}) dùng lại được.`,
		confirm: "Bật token",
		toast: "Đã bật yêu cầu token MCP.",
	},
	disable: {
		title: "Tắt token cho MCP",
		question: () => "Tắt yêu cầu token?",
		body: "Ai biết URL MCP đều gọi được, giống REST. Token hiện tại được giữ lại; bật lại thì token này dùng tiếp.",
		confirm: "Tắt token",
		toast: "Đã tắt yêu cầu token MCP.",
	},
	rotate: {
		title: "Xoay token MCP",
		question: (project: string) => `Tạo token MCP mới cho ${project}?`,
		body: "Token cũ hết hiệu lực ngay. Agent đang dùng token cũ nhận 401 cho tới khi bạn cập nhật token mới.",
		confirm: "Xoay token",
	},
} as const;
