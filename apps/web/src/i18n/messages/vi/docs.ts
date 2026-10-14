import type { Messages } from "../../message-types";
import { docsCustomResponses } from "./docs-custom-responses";
import { docsMcp } from "./docs-mcp";
import { docsPublicSharing } from "./docs-public-sharing";
import { docsQuickStart } from "./docs-quick-start";
import { docsReference } from "./docs-reference";

export const docs: Messages["docs"] = {
	documentTitle: "{page} · Tài liệu Localman",
	toc: {
		label: "Mục lục tài liệu",
		heading: "Tài liệu",
	},
	pager: {
		label: "Trang trước và trang sau",
		previous: "Trang trước",
		next: "Trang sau",
	},
	pages: {
		quickStart: {
			title: "Quick start",
			summary: "Từ project trống tới API gọi được",
		},
		codeExamples: {
			title: "Code examples",
			summary: "fetch, axios và curl",
		},
		customResponses: {
			title: "Custom responses",
			summary: "Đổi hình dạng body trả về",
		},
		mcp: {
			title: "MCP tools",
			summary: "Kết nối AI agent với mock của bạn",
		},
		publicSharing: {
			title: "Chia sẻ công khai",
			summary: "Chia sẻ collection ra ngoài workspace",
		},
	},
	headerMethod: "Method",
	headerRoute: "Route",
	quickStart: docsQuickStart,
	reference: docsReference,
	codeExamples: {
		lead: "Gọi mock API bằng fetch, axios hoặc curl: đọc, ghi, route lồng, phân trang và xử lý lỗi.",
		howToRead: "Cách đọc ví dụ",
		intro:
			"Ví dụ dùng resource <code>customers</code> và resource <code>orders</code> lồng bên trong, với các field <code>product</code>, <code>quantity</code> và <code>paid</code>. Thay <angle>secret</angle> bằng secret trong thẻ API endpoint của project. Các khối sau dùng lại <code>BASE_URL</code>, <code>JSON_HEADERS</code> và <code>api</code> khai báo ở khối đầu tiên.",
		languageLegend: "Ngôn ngữ của ví dụ",
		titles: {
			crud: "Đọc và ghi trên route phẳng",
			nested: "Route lồng",
			pagination: "Lọc, sắp xếp và phân trang",
			errors: "Xử lý lỗi",
		},
		paginationNote:
			"Danh sách mặc định chỉ là mảng bản ghi. Muốn nhận cả tổng số bản ghi để vẽ thanh phân trang, xem <countLink>danh sách kèm tổng số bản ghi</countLink> trong Custom responses. Mọi tham số được liệt kê ở <queryLink>bảng tham số query</queryLink>.",
		errorsNote:
			"Mỗi response có header <code>X-Localman-Request-Id</code>. Xem thêm <statusLink>bảng mã trạng thái và mã lỗi</statusLink>.",
	},
	customResponses: docsCustomResponses,
	mcp: docsMcp,
	publicSharing: docsPublicSharing,
};
