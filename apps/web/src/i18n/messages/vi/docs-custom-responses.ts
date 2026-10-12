import type { Messages } from "../../message-types";

export const docsCustomResponses: Messages["docs"]["customResponses"] = {
	lead: "Đổi hình dạng body mà từng endpoint trả về, ví dụ bọc danh sách trong một object có tổng số bản ghi, hoặc tắt hẳn một endpoint.",
	default: {
		title: "Mặc định",
		body: 'Mỗi endpoint có một response template. Template mặc định là chuỗi <code>"$mockData"</code>, nghĩa là body chính là dữ liệu: GET danh sách trả mảng, GET một bản ghi trả object, POST trả bản ghi mới, PUT và PATCH trả bản ghi sau khi sửa, DELETE trả bản ghi vừa xoá.',
	},
	edit: {
		title: "Sửa template",
		body: "Bấm Sửa trên resource. Mục Endpoints liệt kê năm endpoint, mỗi cái có công tắc bật tắt và ô Response template nhận JSON. Bấm Cập nhật để lưu; request kế tiếp dùng template mới ngay.",
	},
	variables: {
		title: "Biến trong template",
		caption: "Ba loại biến của response template",
		headerVariable: "Biến",
		headerValue: "Giá trị",
		mockData:
			"Dữ liệu endpoint trả về khi không có template: mảng bản ghi (đã lọc, sắp xếp, cắt trang) với GET danh sách, một bản ghi với các endpoint còn lại.",
		count:
			"Số bản ghi. Ở GET danh sách là số bản ghi khớp bộ lọc, tính trước khi cắt trang. Ở endpoint khác là số bản ghi của collection theo route, đếm sau khi ghi (trên route lồng chỉ đếm bản ghi con của bản ghi cha đó).",
		faker:
			"Một giá trị Faker sinh mới ở mỗi request, ví dụ {examples}. Dùng được mọi method có trong ô chọn Faker của schema.",
		wholeString:
			'Một chuỗi chỉ được thay khi <em>cả chuỗi</em> là một biến: <code>"Xin chào $name.firstName"</code> được giữ nguyên chữ. Số, boolean, chuỗi thường, object và mảng lồng nhau giữ nguyên; biến nằm sâu trong object vẫn được thay. Biến không tồn tại, như lỗi gõ <code>"$mockdata"</code>, bị từ chối ngay lúc lưu.',
	},
	count: {
		title: "Danh sách kèm tổng số bản ghi",
		body: "Template này cho endpoint GET danh sách trả về trang dữ liệu cùng tổng số bản ghi, đủ để vẽ thanh phân trang:",
		templateCaption: "Template của GET /customers",
		responseCaption: "GET /customers?page=2&limit=10 (rút gọn còn 2 bản ghi)",
	},
	write: {
		title: "Bọc bản ghi khi ghi",
		body: 'Với POST, PUT và DELETE, <code>"$mockData"</code> là một bản ghi, còn <code>"$count"</code> là số bản ghi sau khi ghi. PATCH dùng chung template với PUT.',
		templateCaption: "Template của POST /customers",
		responseCaption: "POST /customers với body {body}",
	},
	limits: {
		title: "Những gì template không đổi",
		body: 'Template chỉ đổi body. Mã trạng thái giữ nguyên (200, hoặc 201 với POST), và lỗi không đi qua template: 404 vẫn là <code>"Not found"</code>, lỗi khác vẫn là <code>{errorShape}</code>.',
		size: "Một template sâu tối đa {depth} tầng, có tối đa {values} giá trị và {faker} biến Faker. Body sau khi render vượt {mb} MB thì nhận 422 <code>RESPONSE_TOO_LARGE</code>; giảm số bản ghi bằng <code>limit</code>.",
	},
	disable: {
		title: "Tắt một endpoint",
		body: 'Tắt công tắc của một endpoint thì route đó trả 404 <code>"Not found"</code> trên cả route phẳng lẫn route lồng, các endpoint khác vẫn chạy. PATCH đi theo công tắc của PUT, HEAD đi theo GET. Ví dụ: tắt DELETE để người dùng thử bản demo không xoá được dữ liệu mẫu.',
	},
};
