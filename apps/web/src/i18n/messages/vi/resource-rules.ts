import type { Messages } from "../../message-types";

export const resourceRules: Messages["resourceRules"] = {
	toggle: "Quy tắc",
	toggleCount: { other: "Quy tắc · {count}" },
	toggleLabel: "Quy tắc cho {endpoint}",
	intro:
		"Trả response khác khi request khớp điều kiện. Quy tắc chạy từ trên xuống; quy tắc khớp đầu tiên được dùng.",
	empty:
		"Chưa có quy tắc nào. Khi không có quy tắc, endpoint này trả response template của nó.",
	add: "Thêm quy tắc",
	limit: "Tối đa {max} quy tắc mỗi endpoint.",
	limitReached: "Endpoint này đã có {max} quy tắc, mức tối đa.",
	title: "Quy tắc {position}",
	toggleRule: "Quy tắc {position}: {summary}",
	incomplete: "Quy tắc chưa đủ thông tin",
	checkRule: "Kiểm tra quy tắc này",
	when: "Khi",
	respond: "Trả về",
	source: "So khớp theo",
	sources: {
		header: "Header",
		query: "Query parameter",
		body: "Body (JSONPath)",
		nth: "Request thứ N",
	},
	summarySources: {
		header: "header",
		query: "query",
		body: "body",
		nth: "request thứ N",
	},
	target: {
		header: "Tên header",
		query: "Tên parameter",
		body: "JSONPath",
	},
	op: "Điều kiện",
	ops: {
		eq: "bằng",
		neq: "khác",
		contains: "chứa",
		regex: "khớp regex",
		exists: "có mặt",
		gt: "lớn hơn",
		lt: "nhỏ hơn",
	},
	value: "Giá trị",
	fieldOf: "{field} của quy tắc {position}",
	headerHint: "Tên header không phân biệt chữ hoa, chữ thường.",
	nthHint:
		"Đếm request tới endpoint này, bắt đầu từ 1. Bộ đếm bắt đầu lại khi bạn lưu resource.",
	status: "Mã trạng thái",
	headers: "Header (tuỳ chọn)",
	headersHint:
		"Object JSON gồm tên header và giá trị dạng chữ, ví dụ <code>{example}</code>.",
	body: "Body template (tuỳ chọn)",
	bodyHint:
		'Dùng được các biến như response template. Để trống thì trả <code>"$mockData"</code>.',
	moveUp: "Chuyển quy tắc {position} lên",
	moveDown: "Chuyển quy tắc {position} xuống",
	remove: "Xoá quy tắc {position}",
	moved: "Đã chuyển quy tắc tới vị trí {position} trên {count}.",
	removed: "Đã xoá quy tắc {position}.",
	errors: {
		keyRequiredHeader: "Nhập tên header.",
		keyRequiredQuery: "Nhập tên parameter.",
		headerName:
			"Tên header chỉ gồm chữ, số và dấu -, ví dụ <code>x-role</code>.",
		jsonPath:
			"Nhập JSONPath bắt đầu bằng <code>$</code>, ví dụ <code>$.user.role</code>.",
		valueRequired: "Nhập giá trị.",
		number: "Nhập một số để so sánh.",
		nth: "Nhập số nguyên từ 1 trở lên.",
		regex: "Regex này không hợp lệ. Kiểm tra lại ngoặc và ký tự escape.",
		regexUnsafe:
			"Regex này có thể làm mock chạy chậm. Không lặp lại một nhóm, không dùng backreference hay lookaround, và chỉ dùng một <code>+</code> hoặc <code>*</code>.",
		tooLong: "Tối đa {max} ký tự.",
		status: "Nhập mã trạng thái từ {min} đến {max}.",
		headers: "Header phải là object JSON có giá trị dạng chữ.",
		headersMax: "Mỗi quy tắc đặt tối đa {max} header.",
		headerReserved:
			"Rule không đặt được <code>{name}</code>. Dùng header <code>x-…</code> của bạn, hoặc <code>cache-control</code>, <code>etag</code>, <code>retry-after</code> và các header tương tự.",
		headerLocation:
			"<code>location</code> chỉ dùng được với mã trạng thái 3xx, ví dụ 301 hoặc 302.",
		headerContentType:
			"<code>content-type</code> phải là kiểu JSON (<code>application/json</code>, <code>application/…+json</code>) hoặc <code>text/plain</code>.",
		headerValue:
			"Giá trị của <code>{name}</code> phải là chữ thường trên một dòng, tối đa {max} ký tự.",
		server: "Không được chấp nhận: {message}",
	},
};
