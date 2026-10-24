import type { Messages } from "../../message-types";

export const variables: Messages["variables"] = {
	scope: {
		global: "Global",
		collection: "Collection",
		environment: "Environment",
		temporary: "Biến tạm",
		dynamic: "Biến động",
		response: "Response",
	},
	reference: {
		note: "Giá trị tại <code>{path}</code> của response gần nhất của <b>{request}</b>; khi response đó cũ hơn {ttl} giây, gửi request này sẽ gửi lại “{request}” trước.",
		value: "Giá trị hiện tại",
		notSent:
			"“{request}” chưa được gửi trong tab này: gửi request này sẽ gửi nó trước.",
		missing:
			"Response gần nhất của “{request}” không có giá trị ở đường dẫn này.",
	},
	tooltip: {
		empty: "(rỗng)",
		secret: "Giá trị secret đã được che",
		unreadableValue: "Mã hoá bằng kho khác",
		unreadableNote:
			"Giá trị local của biến secret này ({scope}) được mã hoá bằng một kho khác nên không mở được. Request dùng <code>{token}</code> sẽ dừng cho tới khi bạn thay hoặc xoá giá trị đó.",
		withheld: "Bị ẩn với bạn: đặt giá trị local của riêng bạn để dùng biến này",
		locked: "Đã khoá",
		lockedValue: "Đang khoá trong kho",
		lockedNote:
			"Giá trị local của biến secret này ({scope}) nằm trong kho đang khoá. Request dùng <code>{token}</code> sẽ dừng, không gửi, cho tới khi mở kho.",
		unlock: "Mở kho",
		openEnvironment: "Mở {name}",
		openGlobals: "Mở globals",
		noValue: "(chưa có giá trị)",
		from: "Giá trị lấy từ {scope}",
		fromNamed: "Giá trị lấy từ {scope} · {name}",
		overridden: "Bị ghi đè",
		disabled: "(đã tắt)",
		precedence: "Thứ tự ưu tiên: Global < Collection < Environment < Biến tạm",
		dynamic: "Mỗi lần gửi request sẽ sinh một giá trị mới.",
		undeclared: "Chưa khai báo",
		undeclaredNote:
			"Không scope nào đang dùng khai báo biến này, nên <code>{token}</code> được gửi nguyên văn.",
		inactiveNote: "Có biến cùng tên nhưng đã tắt hoặc chưa có giá trị.",
	},
	add: {
		scope: "Thêm vào",
		value: "Giá trị",
		submit: "Thêm biến",
		viewerNote: "Viewer chỉ thêm được biến tạm.",
	},
	choice: {
		environment: "Environment · {name}",
		environmentNone: "Environment",
		collection: "Collection · {name}",
		collectionNone: "Collection",
		global: "Globals",
		temporary: "Biến tạm (tab này)",
		help: {
			environment: "Shared value, đồng bộ cho mọi người có quyền",
			collection: "Dùng chung cho mọi người mở được collection",
			global: "Dùng ở mọi request trong workspace này",
			temporary: "Chỉ sống trong tab này đến khi đóng; ưu tiên cao nhất",
		},
		blocked: {
			editorsOnly: "Chỉ Editor sửa được scope này",
			noEnvironment: "Chưa có environment nào đang dùng",
			noCollection: "Request này chưa được lưu vào collection",
			noWorkspace: "Chưa tải xong biến global",
		},
		option: "{label} ({reason})",
	},
	set: {
		action: "Đặt làm biến",
		title: "Đặt làm biến",
		name: "Tên biến",
		namePlaceholder: "authToken",
		value: "Giá trị",
		scope: "Scope",
		submit: "Đặt biến",
		done: "Đã đặt {name} vào {scope}",
		failed: "Không đặt được biến.",
		localReset:
			"Giá trị local của bạn đã được reset để giá trị mới có hiệu lực.",
		localKept:
			"Không reset được giá trị local của bạn cho {name}, nên nó vẫn ghi đè giá trị mới.",
		errors: {
			nameRequired: "Hãy nhập tên biến.",
			nameInvalid:
				"Tên không chứa khoảng trắng hay dấu ngoặc nhọn và không bắt đầu bằng $.",
			nameTooLong: "Tên dài tối đa {max} ký tự.",
			valueTooLong: "Giá trị dài tối đa {max} ký tự.",
		},
	},
	existing: {
		replace:
			"{name} đã có ở đây. Đặt biến sẽ thay shared value của nó cho mọi người dùng scope này.",
		disabled:
			"Biến đang tắt và vẫn giữ trạng thái tắt: giá trị mới chưa được dùng cho đến khi Editor bật lại.",
		local:
			"Giá trị local của bạn cho biến này sẽ được reset để giá trị mới có hiệu lực.",
	},
	suggest: {
		label: "Gợi ý biến",
	},
	temporary: {
		title: "Biến tạm",
		note: "Chỉ giữ trong tab này và mất khi đóng tab. Biến tạm ghi đè mọi scope.",
		empty:
			"Tab này chưa có biến tạm. Bôi đen một đoạn chữ rồi chọn Đặt làm biến để thêm.",
		caption: "Biến tạm của tab này",
		remove: "Xoá {name}",
	},
};
