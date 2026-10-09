import type { Messages } from "../../message-types";

export const mcp: Messages["mcp"] = {
	tabs: {
		label: "Endpoint của mock",
		rest: "REST",
		mcp: "MCP",
	},
	endpoint: {
		title: "MCP endpoint",
		urlLabel: "URL MCP",
		urlItem: "URL",
		urlHint:
			"Tool thao tác trên chính dữ liệu có trạng thái của mock: tạo qua MCP thì GET REST thấy ngay. Mỗi lần gọi tool tính 1 request tới mock.",
	},
	config: {
		title: "Cấu hình cho agent",
		legend: "Định dạng cấu hình",
		jsonLabel: "JSON chung",
		hintOff: "Không cần token: ai biết URL MCP đều gọi được, giống REST.",
		hintOn:
			"Cấu hình đọc token từ biến môi trường <code>{env}</code>. Đặt biến này trước khi chạy lệnh hoặc mở lại editor.",
		hintUnknown:
			"Nếu project yêu cầu token cho MCP, hỏi chủ project để lấy token rồi thêm header <code>Authorization: Bearer …</code>.",
		shellHint:
			"Lệnh terminal viết cho bash/zsh (<code>${env}</code>). Trên PowerShell đổi thành <code>$env:{env}</code>, trên cmd thành <code>%{env}%</code>.",
	},
	token: {
		title: "Yêu cầu token cho MCP",
		loading: "Đang tải cài đặt token…",
		loadFailed: "Không tải được cài đặt token",
		helpOff:
			"Mặc định giống REST: ai biết URL MCP đều gọi được. Bật để bắt buộc Bearer token riêng của project, dùng được ở mọi gói.",
		helpOn:
			"Gọi thiếu header <code>Authorization: Bearer …</code> nhận 401. Token chỉ hiện một lần lúc tạo; mất token thì xoay token mới.",
		hint: "Token lmmcp_…{last4} · tạo {created}",
		rotate: "Xoay token",
		collaboratorNote:
			"Chủ project quản lý token MCP. Nếu MCP đang yêu cầu token, hỏi chủ project để lấy token.",
		revealTitle: "Lưu token ngay",
		revealLabel: "Token MCP",
		revealItem: "token",
		revealHint:
			"Token chỉ hiện lần này, Localman không lưu bản đọc được. Đặt vào biến <code>{env}</code> để các cấu hình bên trên dùng được.",
		revealDismiss: "Đã lưu token",
	},
	dialogs: {
		enable: {
			title: "Bật token cho MCP",
			question: "Bật yêu cầu token cho {project}?",
			body: "Agent đang gọi MCP mà không kèm token sẽ nhận 401 ngay.",
			bodyNew: "Token mới chỉ hiện một lần sau bước này.",
			bodyKept: "Token đã tạo trước đây (lmmcp_…{last4}) dùng lại được.",
			confirm: "Bật token",
			toast: "Đã bật yêu cầu token MCP.",
		},
		disable: {
			title: "Tắt token cho MCP",
			question: "Tắt yêu cầu token?",
			body: "Ai biết URL MCP đều gọi được, giống REST. Token hiện tại được giữ lại; bật lại thì token này dùng tiếp.",
			confirm: "Tắt token",
			toast: "Đã tắt yêu cầu token MCP.",
		},
		rotate: {
			title: "Xoay token MCP",
			question: "Tạo token MCP mới cho {project}?",
			body: "Token cũ hết hiệu lực ngay. Agent đang dùng token cũ nhận 401 cho tới khi bạn cập nhật token mới.",
			confirm: "Xoay token",
		},
	},
	tools: {
		title: "Tool tự sinh",
		countUnit: { other: "tool" },
		empty:
			"Chưa có tool. Thêm resource để có <code>list_</code>, <code>get_</code>, <code>create_</code>, <code>update_</code> và <code>delete_</code> cho resource đó.",
		allOff:
			"Mọi endpoint đang tắt nên chưa có tool nào. Bật endpoint trong Sửa resource.",
		footnote:
			"Endpoint đang tắt thì không sinh tool. MCP resources: <code>mock://schema</code>, <code>mock://openapi</code>.",
		readOnly: "chỉ đọc",
		destructive: "phá huỷ",
		createParams: "body theo schema",
	},
	try: {
		button: "Thử",
		intro:
			"MCP Inspector là công cụ mã nguồn mở của dự án MCP, chạy trên máy bạn qua Node.js. Chạy lệnh dưới đây trong terminal: Inspector mở giao diện trong trình duyệt để bạn kết nối và gọi thử từng tool.",
		commandCaption: "Inspector",
		cliCaption: "Kiểm nhanh trong terminal",
		quota: "Mỗi lần gọi tool tính 1 request vào hạn mức mock của bạn.",
		docs: "Tài liệu MCP Inspector",
	},
};
