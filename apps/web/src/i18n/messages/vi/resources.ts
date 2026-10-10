import type { Messages } from "../../message-types";

export const resources: Messages["resources"] = {
	records: { other: "{count} bản ghi" },
	changeLine: { other: "{before} → {count} bản ghi" },
	lostLead: "Các resource con sau sẽ mất dữ liệu:",
	errors: {
		invalidAt: "Dữ liệu không hợp lệ ở “{path}”: {message}",
		invalid: "Dữ liệu gửi lên không hợp lệ.",
		templateTooLarge:
			"Object template có thể sinh bản ghi lớn hơn 32 KB. Hãy rút gọn template.",
		notFound:
			"Resource hoặc project không còn tồn tại. Tải lại trang để cập nhật.",
		parentHasNoData: "Cần sinh dữ liệu cho resource cha trước.",
		nameTaken: "Đã có resource cùng tên ở vị trí này.",
		treeCycle:
			"Không thể lồng resource vào chính nó hoặc vào resource con của nó.",
		fieldConflict:
			"Thay đổi này làm một field trùng tên với field sinh tự động (ví dụ userId). Đổi tên hoặc xoá field đó trước.",
		planLimit: "Bạn đã dùng hết số resource gói hiện tại cho phép.",
		forbidden: "Bạn chỉ có quyền xem project này.",
		requestTooLarge: "Dữ liệu gửi lên quá lớn (tối đa 2 MB mỗi resource).",
		recordTooLarge:
			"Dữ liệu có bản ghi vượt 32 KB. Hãy rút gọn bản ghi hoặc template.",
		recordTooLargeOf:
			"Dữ liệu của {name} có bản ghi vượt 32 KB. Hãy rút gọn bản ghi hoặc template.",
		dataTooLarge:
			"Dữ liệu vượt 2 MB. Hãy giảm số bản ghi hoặc kích thước mỗi bản ghi.",
		dataTooLargeOf:
			"Dữ liệu của {name} vượt 2 MB. Hãy giảm số bản ghi hoặc kích thước mỗi bản ghi.",
	},
	validation: {
		nameRequired: "Nhập tên resource.",
		nameTooLong: "Tên tối đa {max} ký tự.",
		namePattern:
			"Chỉ dùng chữ không dấu, số, - và _, bắt đầu bằng chữ hoặc số.",
		nameReserved:
			'Tên "{name}" dành cho endpoint MCP của project, hãy chọn tên khác.',
		tooManyFields: "Mỗi resource có tối đa {max} field.",
		fieldRequired: "Nhập tên field.",
		fieldTooLong: "Tên field tối đa {max} ký tự.",
		fieldPattern: "Tên field chỉ gồm chữ không dấu, số, _, - và dấu chấm.",
		fieldForbidden: "Không dùng được tên “{name}”.",
		fieldGenerated: "Field “{name}” được sinh tự động.",
		fieldDuplicate: "Field “{name}” bị trùng.",
		fakerMethod: "Chọn một Faker method trong danh sách.",
		childRequired: "Chọn resource con.",
		parentOnRoot: "Resource gốc không có Parent Resource.",
		parentRepeated: "Đã có field “{first}” lấy bản ghi cha.",
		childRepeated: "Đã có field “{first}” lấy resource con này.",
		templateInvalid: "Object template không phải JSON hợp lệ.",
		templateNotObject: "Object template phải là một object JSON.",
		responseInvalid: "Response template không phải JSON hợp lệ.",
	},
	form: {
		titleNew: "Resource mới",
		titleEdit: "Sửa resource · {name}",
		create: "Tạo resource",
		update: "Cập nhật",
		nameLabel: "Tên resource",
		nameHint:
			"Dùng làm đường dẫn endpoint, ví dụ <code>/users</code>. Chỉ gồm chữ không dấu, số, <code>-</code> và <code>_</code>.",
		childOf: "Resource con của <code>{parent}</code>.",
		schemaHint: "Cấu trúc mỗi bản ghi",
		checkMarked: "Kiểm tra lại các ô được đánh dấu đỏ.",
	},
	schema: {
		typeOf: "Kiểu của {name}",
		sourceOf: "Nguồn của {name}",
		fieldFallback: "field {position}",
		fieldName: "Tên field {position}",
		dataType: "Kiểu dữ liệu của {label}",
		noMethod: "Kiểu này không cần method ({label})",
		fakerMethod: "Faker method của {label}",
		childResource: "Resource con của {label}",
		remove: "Xoá field {label}",
		addField: "Thêm field",
		noMatch: "Không có method nào khớp.",
		suggested: "gợi ý",
		suggestedHint:
			"theo tên field<sr>. Bạn có thể chọn method khác bất cứ lúc nào.</sr>",
	},
	template: {
		hint: 'Template JSON thay cho schema ở trên, dùng cho cấu trúc lồng phức tạp. Giá trị dạng <code>"$category.method"</code> gọi Faker (ví dụ <code>"$internet.email"</code>). Để trống để dùng schema.',
	},
	endpoints: {
		list: "Danh sách",
		one: "Một bản ghi",
		create: "Tạo",
		update: "Cập nhật (PUT, PATCH)",
		delete: "Xoá",
		enable: "Bật {endpoint}",
		variables:
			'Biến trong template: <code>"$mockData"</code> dữ liệu đang lưu, <code>"$count"</code> số bản ghi, <code>"$category.method"</code> giá trị Faker sinh mỗi request (ví dụ <code>"$name.fullName"</code>).',
	},
	data: {
		title: "Dữ liệu · {name}",
		hint: "Sửa trực tiếp hoặc dán một mảng JSON mới để thay toàn bộ dữ liệu (tối đa {max} bản ghi).",
		loading: "Đang tải dữ liệu…",
		loadFailed: "Không tải được dữ liệu",
		jsonLabel: "Dữ liệu JSON của {name}",
		update: "Cập nhật",
		confirmTitle: "Cập nhật dữ liệu",
		confirmQuestion: "Thay dữ liệu của “{name}”?",
		notArray: "Dữ liệu phải là một mảng JSON.",
		tooMany: "Tối đa {max} bản ghi (đang có {count}).",
		notObject: "Mỗi phần tử phải là một object JSON.",
	},
	delete: {
		title: "Xoá resource",
		question: "Xoá “<code>{name}</code>”?",
		confirm: "Xoá resource",
		body: {
			other: "Schema, endpoint và {count} bản ghi của {name} sẽ bị xoá.",
		},
		checking: "Đang kiểm tra resource con…",
		cascadeUnknown: "Mọi resource con và dữ liệu của chúng cũng bị xoá.",
		cascade: { other: "Sẽ xoá kèm {count} resource con:" },
		irreversible: "Hành động này không thể hoàn tác.",
	},
};
