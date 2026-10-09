import type { Messages } from "../../message-types";

export const docsMcp: Messages["docs"]["mcp"] = {
	lead: "Cho AI coding agent làm việc với mock của bạn qua MCP (Model Context Protocol). Mỗi project có Hosted Mock MCP riêng cho dữ liệu của nó; Localman MCP quản lý project và resource của bạn.",
	hosted: {
		title: "Hosted Mock MCP",
		url: "Mỗi project có MCP endpoint ở <code>{url}</code>, tức URL mock thêm <code>/mcp</code>, qua Streamable HTTP. Tab MCP trong trang project hiện đúng URL và cấu hình sẵn cho Claude Code, Cursor và các client khác.",
		caption: "URL Hosted Mock MCP của một project",
		tools:
			"Tool sinh theo resource: <code>list_</code>, <code>get_</code>, <code>create_</code>, <code>update_</code> và <code>delete_</code> cộng tên resource, cho mọi resource kể cả resource lồng, và chỉ cho endpoint đang bật. Tool thao tác trên cùng dữ liệu với REST, nên bản ghi tạo qua MCP thì REST thấy ngay. Resource lồng nhận <code>parentId</code>; <code>list_</code> nhận tham số query như REST và trả <code>{listShape}</code>.",
		resources:
			"Hai MCP resource mô tả mock: <code>mock://schema</code> (cây resource, route lồng, schema, endpoint và tool của từng resource) và <code>mock://openapi</code> (OpenAPI 3.1 của các endpoint đang bật).",
		token:
			"Giống REST, ai có URL đều gọi được endpoint này. Chủ project có thể bật yêu cầu token cho MCP trong tab MCP, ở mọi gói: khi đó lời gọi cần <code>Authorization: Bearer lmmcp_…</code>, thiếu hoặc sai token nhận 401. Token chỉ hiện một lần, lúc tạo.",
		limits:
			"Mỗi lần gọi tool tính 1 request vào hạn mức mock hằng tháng của chủ project và qua cùng rate limit như REST; vượt giới hạn thì tool trả lỗi <code>RATE_LIMITED</code> hoặc <code>MONTHLY_QUOTA_EXCEEDED</code>. Custom response không áp dụng cho kết quả MCP.",
		limitsFree:
			"Mỗi lần gọi tool tính 1 request vào hạn mức mock hằng tháng của chủ project (gói Free: {requests} request mỗi tháng) và qua cùng rate limit như REST; vượt giới hạn thì tool trả lỗi <code>RATE_LIMITED</code> hoặc <code>MONTHLY_QUOTA_EXCEEDED</code>. Custom response không áp dụng cho kết quả MCP.",
	},
	localman: {
		title: "Localman MCP",
		intro:
			"Localman MCP ở <code>{url}</code> cho agent quản lý project và resource của bạn: tạo project, thêm resource từ kiểu TypeScript, OpenAPI hoặc JSON Schema, sinh dữ liệu và lấy URL mock. Agent hành động thay bạn, với cùng quyền và hạn mức gói như trên web.",
		signIn:
			"Agent đăng nhập bằng OAuth qua tài khoản hoandat ở <code>{idp}</code>: client tự đăng ký và mở trình duyệt để bạn cho phép truy cập. <code>mock:read</code> cho đọc project, resource, dữ liệu và URL mock (kể cả secret); <code>mock:write</code> cho thay đổi chúng. Tool tạo credential xin thêm <code>credentials:write</code>.",
		claudeAfter:
			"Sau đó chạy <code>/mcp</code> trong Claude Code và chọn <code>localman</code> để đăng nhập.",
		cursorAfter: "Cursor mở trang đăng nhập ở lần kết nối đầu tiên.",
		limits:
			"Request bị giới hạn tốc độ theo tài khoản; vượt giới hạn thì nhận 429 kèm header <code>Retry-After</code>.",
	},
	tools: {
		title: "Tool của Localman MCP",
		intro:
			"Localman MCP phục vụ toolset <code>mock</code>, toolset mà OAuth cấp quyền. Tool chỉ đọc cần <code>mock:read</code>, tool còn lại cần <code>mock:write</code>.",
		caption: "Tool của toolset mock",
		headerTool: "Tool",
		headerScopes: "Scope",
		headerConfirm: "Xác nhận",
		headerSummary: "Tác dụng",
		confirmNone: "Không",
		confirmOptional: "<code>dry_run</code> tuỳ chọn",
		confirmRequired: "<code>dry_run</code> rồi <code>confirm_token</code>",
		confirmFlow: {
			other:
				"{count} tool thay đổi hoặc xoá nhiều dữ liệu một lúc nên chạy hai bước: gọi với <code>dry_run: true</code> để xem trước và nhận <code>confirm_token</code>, rồi gọi lại kèm <code>confirm_token</code> đó để thực hiện. Tool có <code>dry_run</code> tuỳ chọn thì xem trước được nhưng không bắt buộc.",
		},
	},
	toolSummaries: {
		listProjects: "Liệt kê các mock project",
		getProject: "Xem một mock project",
		createProject: "Tạo mock project",
		updateProject: "Đổi tên mock project hoặc đổi prefix",
		deleteProject: "Xoá mock project cùng mọi thứ bên trong",
		cloneProject: "Nhân bản mock project",
		rotateProjectSecret: "Cấp secret mới cho mock project (URL mock mới)",
		getMcpTokenSettings:
			"Xem MCP endpoint của mock project có yêu cầu token không",
		setMcpTokenRequired:
			"Bật (hoặc tắt) yêu cầu Bearer token trên MCP endpoint của mock",
		rotateMcpToken: "Thay Bearer token của MCP endpoint của mock",
		listResources: "Liệt kê cây resource của mock project",
		createResource: "Tạo resource trong mock project",
		getResource: "Xem một resource của mock project",
		updateResource: "Đổi tên resource hoặc đổi schema, template, endpoint",
		createResourceFromSchema:
			"Tạo resource từ kiểu TypeScript, OpenAPI hoặc JSON Schema",
		deleteResource: "Xoá resource cùng resource con và bản ghi",
		moveResource: "Lồng resource vào resource khác, hoặc đưa về gốc",
		listFakerMethods:
			"Liệt kê các method Faker dùng được trong schema và template",
		generateResourceData: "Thay bản ghi của resource bằng dữ liệu sinh mới",
		generateAllResourceData: "Sinh lại bản ghi của mọi resource trong project",
		resetAllResourceData: "Xoá bản ghi của mọi resource trong project",
		getResourceData: "Lấy bản ghi thô của resource",
		replaceResourceData: "Thay bản ghi của resource bằng một mảng JSON",
		getMockUrls: "Lấy URL REST và MCP của mock project",
	},
};
