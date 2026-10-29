import type { Messages } from "../../message-types";

export const resourceImport: Messages["resourceImport"] = {
	entry: "Nhập",
	title: "Nhập resource",
	description: "Tạo resource từ JSON mẫu, tài liệu OpenAPI hoặc file CSV/JSON.",
	tabs: { json: "JSON mẫu", openapi: "OpenAPI", file: "File CSV hoặc JSON" },
	json: {
		label: "JSON mẫu",
		hint: "Dán một object hoặc một mảng object. Mỗi object thành một bản ghi (tối đa {max}).",
	},
	openapi: {
		label: "Tài liệu OpenAPI",
		chooseFile: "Chọn file",
		hint: "OpenAPI 3.0 hoặc 3.1 dạng JSON, tối đa 2 MB. Hãy chuyển YAML sang JSON trước. Chỉ đọc tham chiếu trong chính tài liệu (<code>#/components/…</code>).",
		schema: "Schema",
		schemaHint: {
			other:
				"{count} schema trong <code>components.schemas</code>. Chọn schema sẽ thành resource.",
		},
		related: "Tạo cả các resource liên quan",
		relatedOn:
			"Schema được tham chiếu bằng <code>$ref</code> thành resource lồng bên trong.",
		relatedOff: "Schema được tham chiếu thành field kiểu Object.",
	},
	file: {
		choose: "Chọn file CSV hoặc JSON",
		drop: "hoặc thả file vào đây · tối đa 2 MB",
		hint: "CSV: dòng đầu là tiêu đề cột, giá trị ngăn bằng dấu phẩy, mã hoá UTF-8. Kiểu dữ liệu được đoán từ 100 dòng đầu.",
		chosen: "{name} · {size} KB",
		remove: "Bỏ file",
		reading: "Đang đọc file…",
	},
	preview: {
		title: "Xem trước",
		empty: "Dán hoặc chọn nguồn để xem schema và 5 bản ghi đầu ở đây.",
		loading: "Đang dựng bản xem trước…",
		ready: "Đã có bản xem trước: {fields}, {records}.",
		fields: { other: "{count} field" },
		schema: "Schema",
		field: "Field",
		type: "Kiểu",
		method: "Faker method",
		firstRecords: "{shown} bản ghi đầu trên tổng {count}",
		sample: "Bản ghi mẫu sinh từ schema",
		sampleNote:
			"Resource bắt đầu trống. Bấm vào thanh xám của nó để sinh dữ liệu.",
		alsoCreates: "Tạo thêm:",
		relatedName: "Tên của resource liên quan {name}",
		truncated: "Nguồn có hơn {max} bản ghi. Chỉ {max} bản ghi đầu được nhập.",
		notes: { other: "{count} ghi chú" },
		showAll: "Xem cả {count}",
		rowsRegion: "Xem trước bản ghi",
	},
	nameLabel: "Tên resource",
	planRoom: {
		other:
			"Thao tác này tạo {count} resource, nhưng project chỉ còn chỗ cho {left} resource.",
	},
	planRoomHint:
		"Hãy tắt resource liên quan, hoặc xoá các resource không còn dùng.",
	submit: "Tạo resource",
	errors: {
		tooLarge:
			"File nặng {size} KB, vượt giới hạn 2 MB. Hãy dùng file nhỏ hơn hoặc tách file.",
		pastedTooLarge: "Nội dung dán vào vượt 2 MB. Hãy dán mẫu nhỏ hơn.",
		inputTooLarge: "Nguồn vượt 2 MB. Hãy dùng nguồn nhỏ hơn.",
		payloadTooLarge:
			"Nguồn quá lớn để gửi sau khi mã hoá, ví dụ vì có nhiều dấu ngoặc kép hoặc xuống dòng. Hãy dùng nguồn nhỏ hơn.",
		fileType: "Hãy chọn file .csv hoặc .json.",
		readFailed: "Không đọc được file. Hãy chọn lại.",
		jsonShape:
			"Hãy dán một object JSON hoặc một mảng object. Giá trị khác không thành bản ghi được.",
		jsonEmpty:
			"Mảng đang trống nên không có field nào để đọc. Hãy dán ít nhất một object.",
		invalidJson: "Đây không phải JSON hợp lệ. Hãy kiểm tra rồi thử lại.",
		invalidCsv:
			"Không đọc được CSV này. Hãy kiểm tra dòng đầu có đặt tên các cột.",
		notOpenApi:
			"Đây không phải tài liệu OpenAPI 3.x. Hãy kiểm tra đó là JSON có field <code>openapi</code> là 3.0 hoặc 3.1.",
		schemaNotFound:
			"Không có schema tên “{name}”. Hãy chọn một schema trong danh sách.",
		refCycle:
			"Các schema này tham chiếu lẫn nhau thành vòng: <code>{cycle}</code>. Hãy chọn schema khác, hoặc bỏ vòng tham chiếu khỏi tài liệu rồi thử lại.",
		externalRef:
			"<code>{ref}</code> trỏ ra ngoài tài liệu này. Localman không tải file hay URL khác. Hãy chép schema đó vào tài liệu rồi thử lại.",
		tooDeep: "Schema lồng sâu quá {max} cấp. Hãy chọn schema nhỏ hơn.",
		tooComplex:
			"Schema có quá nhiều field hoặc tham chiếu để nhập. Hãy chọn schema nhỏ hơn.",
		noFields:
			"Không tìm thấy field nào. Nguồn cần ít nhất một thuộc tính ngoài <code>id</code>.",
		csvEmpty: "File không có dòng dữ liệu nào.",
		csvQuote: "Dòng dữ liệu thứ {row} có dấu ngoặc kép chưa đóng.",
		encoding:
			"File không phải văn bản UTF-8. Hãy lưu lại dạng UTF-8 rồi thử lại.",
		nameDuplicate: "Một resource khác trong lần nhập này đã dùng tên này.",
	},
	warnings: {
		renamed: "Đã đổi tên “{from}” thành <code>{to}</code>.",
		skipped: "Đã bỏ qua <code>{path}</code>.",
		unsupported:
			"<code>{path}</code> dùng cấu trúc Localman chưa ánh xạ được nên được nhập thành {as}.",
		mixedTypes:
			"<code>{field}</code> có giá trị thuộc nhiều kiểu ({types}) nên được nhập thành String.",
		emptyValues: "<code>{field}</code> luôn trống nên được nhập thành {as}.",
		enumValues:
			"<code>{field}</code> chỉ cho phép {values}. Dữ liệu sinh ra không theo danh sách này.",
		foreignKey: "<code>{field}</code> có vẻ là id của một resource khác.",
		keptAsArray: "<code>{path}</code> được giữ thành field kiểu Array.",
		notObjects: {
			other:
				"{count} phần tử của <code>{path}</code> không phải object nên đã bị bỏ qua.",
		},
		tooManyFields: "Chỉ giữ {max} field đầu tiên.",
		tooManyResources:
			"Mỗi lần chỉ nhập được {max} resource. Phần còn lại đã bị bỏ qua.",
		tooManyRecords: "Chỉ {max} bản ghi đầu được nhập.",
		resourceTooLarge:
			"Dữ liệu quá lớn cho một resource nên các bản ghi cuối đã bị bỏ.",
		recordsTooLarge: { other: "{count} bản ghi vượt 32 KB nên đã bị bỏ." },
		duplicateIds: { other: "{count} bản ghi lặp lại id đã dùng trước đó." },
		idsRenumbered: { other: "{count} bản ghi được cấp id mới." },
		csvRowCells:
			"Dòng {row} có {found} cột, nhưng dòng tiêu đề có {expected} cột. Hãy kiểm tra dấu ngoặc kép bị thiếu hoặc dấu phẩy thừa.",
		csvMoreRows: { other: "Còn {count} dòng khác cũng như vậy." },
		moreWarnings: { other: "Còn {count} ghi chú không hiển thị." },
	},
};
