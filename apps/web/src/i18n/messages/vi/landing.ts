import type { Messages } from "../../message-types";

export const landing: Messages["landing"] = {
	meta: {
		titleMock: "Localman · Mock REST API có trạng thái, quan hệ và Faker",
		titleLocalhost: "Localman · Test API localhost ngay trên trình duyệt",
		description:
			"Dựng mock REST API có trạng thái trong vài phút: khai báo resource, sinh dữ liệu bằng Faker.js, lồng quan hệ và có ngay endpoint CRUD.",
	},
	hero: {
		badgeMock: "Mock REST API cho developer",
		badgeLocalhost: "Localhost ngay trên trình duyệt",
		titleMock: "<code>Mock</code> REST API có trạng thái, quan hệ và Faker",
		titleLocalhost: "Test API <code>localhost</code> ngay trên trình duyệt",
		subMock:
			"Khai báo resource, sinh dữ liệu giả bằng một click và có ngay endpoint CRUD đầy đủ. Frontend không phải chờ backend nữa.",
		subLocalhost:
			"<b>Không cần cài app hay extension, chỉ một lệnh Tunelo.</b> Chạy <code>tunelo http 3000</code>, Localman tự nhận tunnel theo port và gửi request tới <code>localhost</code> hay máy trong mạng LAN. Kèm mock REST API có trạng thái để frontend không phải chờ backend.",
		noteMock:
			"Đăng nhập là dùng được ngay: {projects} project, tổng cộng {resources} resource, có sẵn custom response.",
		noteLocalhost:
			"Đăng nhập là dùng được ngay: {projects} project mock, tổng cộng {resources} resource, {proxy} request qua proxy mỗi tháng.",
	},
	preview: {
		viaTunelo: "qua Tunelo",
		tunnelFound: "Tự nhận tunnel port 3000",
		records: { other: "{count} bản ghi" },
	},
	liveSync: {
		title: "Đổi mock, collection tự cập nhật",
		lead: "Mock có trạng thái tự sinh một collection kèm environment chạy được ngay, và giữ chúng đồng bộ. Đổi tên resource thì path của request đổi theo; header hay body bạn đã sửa vẫn được giữ.",
		play: "Đổi tên users → members",
		updated: { other: "{count} request đã cập nhật" },
		synced: "Đã đồng bộ",
		fields: "Field:",
		collection: { other: "Collection · {count} request" },
		headerKept:
			"Header <code>X-Debug</code> bạn đã thêm vào “List {name}” được giữ nguyên.",
	},
	mockMcp: {
		eyebrow: "Mock MCP tức thì",
		title: "Mock của bạn thành tool cho AI agent",
		lead: "Mỗi project mock có sẵn một MCP endpoint. Agent gọi <code>list_users</code> hay <code>create_posts</code> trên chính dữ liệu có trạng thái của mock, bạn không phải tự viết MCP server.",
		snippetHelp:
			"Streamable HTTP · dùng chung dữ liệu với REST. Thay <code>a1b2c3d4</code> bằng secret của project; lệnh đầy đủ nằm ở tab MCP của project.",
		toolsTitle: "Tool tự sinh từ resource",
		toolsBadge: { other: "{count} tool mỗi resource" },
		toolsHelp:
			"Resource lồng như <code>posts</code> nhận thêm <code>parentId</code>. Tạo bản ghi qua MCP thì <code>GET /users</code> thấy ngay.",
	},
	modeling: {
		title: "Mô hình dữ liệu đơn giản",
		lead: "Mỗi resource là một bảng field. Chọn kiểu dữ liệu hoặc method Faker.js, Localman sinh dữ liệu đúng cấu trúc đó.",
		schemaLabel: "Schema của users",
		tableLabel: "Bảng schema, cuộn ngang",
		fieldCount: { other: "{count} field" },
		none: "Không có",
		previewLabel: "Dữ liệu mẫu của users",
		sampleSource: "Dữ liệu mẫu từ Faker.js",
		reroll: "Xem mẫu khác",
	},
	relations: {
		eyebrow: "Quan hệ",
		title: "Quan hệ giữa các resource",
		lead: "Lồng resource vào nhau để có endpoint dạng <code>/users/:userId/posts</code>. Thử lồng <b>comments</b> vào <b>posts</b> bên dưới.",
		tree: "Cây resource",
		nested: "Đã lồng {child} vào {parent}.",
		movedToRoot: "Đã đưa {child} về root.",
		endpoints: "Endpoint được sinh",
		endpointCount: { other: "{count} endpoint" },
		listLabel: "Danh sách endpoint, cuộn dọc",
	},
	features: {
		eyebrow: "Tính năng",
		title: "Và nhiều hơn",
		comingSoon: "Sắp có",
		seeExample: "Xem ví dụ",
		pagination: {
			title: "Phân trang",
			description: "Chia trang danh sách bằng query string.",
		},
		sorting: {
			title: "Sắp xếp",
			description: "Sắp xếp theo field bất kỳ, tăng hoặc giảm dần.",
		},
		filtering: {
			title: "Lọc",
			description: "Tìm trên mọi field hoặc lọc theo một field.",
		},
		generator: {
			title: "Sinh dữ liệu",
			description:
				"{methods} method Faker.js, sinh tới {max} bản ghi mỗi lần bấm.",
		},
		customResponse: {
			title: "Tuỳ biến response",
			description:
				'Template riêng cho từng endpoint, dùng biến <code>"$mockData"</code>, <code>"$count"</code> và Faker.js.',
		},
		collaboration: {
			title: "Cộng tác",
			description:
				"Mời đồng đội bằng username, email hoặc link mời, cùng chỉnh một project.",
		},
		customEndpoints: {
			title: "Custom endpoint",
			description: "Tự định nghĩa đường dẫn và method ngoài CRUD mặc định.",
		},
		webhooks: {
			title: "Webhook",
			description: "Gọi URL của bạn mỗi khi dữ liệu thay đổi.",
		},
	},
	perks: {
		free: "Miễn phí",
		ready: "Dùng được sau một phút",
		inBrowser: "Chạy ngay trên trình duyệt",
	},
};
