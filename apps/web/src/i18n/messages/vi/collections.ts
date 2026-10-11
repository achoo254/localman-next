import type { Messages } from "../../message-types";
import { collectionsTabs } from "./collections-tabs";
import { collectionsTrash } from "./collections-trash";

export const collections: Messages["collections"] = {
	rail: {
		collections: "Collections",
		trash: "Thùng rác",
	},
	sidebar: {
		title: "Collections",
		new: "Tạo mới",
		import: "Import",
		readOnly: "Viewer không thêm được collection vào workspace này.",
		search: "Tìm trong collections",
		searchPlaceholder: "Tìm collection, request…",
		sort: "Sắp xếp collections: {label}",
		sortHeading: "Sắp xếp collections",
		favoritesFirst: "Collection yêu thích luôn đứng đầu.",
		loading: "Đang tải collections…",
		loadFailed: "Không tải được danh sách collection.",
		noMatch: "Không có gì khớp với “{query}”.",
		itemsLoading: "Đang tải các mục…",
		itemsFailed: "Không tải được các mục.",
		searching: "Đang tìm…",
		searchFailed: "Không tìm được trong các collection.",
		resultsLabel: "Kết quả tìm kiếm",
		results: {
			other: "{count} kết quả",
		},
		truncated: "Đang hiện {max} kết quả đầu tiên. Gõ thêm để thu hẹp.",
		openFailed: "Không mở được {name}.",
	},
	sorts: {
		nameAsc: "Tên A–Z",
		nameDesc: "Tên Z–A",
		updated: "Cập nhật gần nhất",
	},
	empty: {
		title: "Chưa có collection",
		body: "Gom request vào collection để lưu lại, chia sẻ với team và export.",
		new: "Tạo collection",
		import: "Import",
	},
	newMenu: {
		blank: "Collection trống",
		template: "Template REST CRUD",
		fromMock: "Từ project mock…",
	},
	defaults: {
		collection: "Collection mới",
		folder: "Folder mới",
		request: "Request mới",
		importedCollection: "Collection đã import",
		importedFolder: "Folder",
		importedRequest: "Request",
	},
	row: {
		star: "Đưa {name} vào yêu thích",
		unstar: "Bỏ {name} khỏi yêu thích",
		more: "Thao tác khác cho {name}",
		rename: "Tên mới cho {name}",
	},
	dnd: {
		instructions:
			"Để di chuyển một mục, bấm Space. Dùng phím mũi tên để đưa nó tới dòng khác, rồi bấm Space để thả hoặc Escape để huỷ.",
		picked: "Đã nhấc {name}.",
		over: "Đang ở trên {target}.",
		dropped: "Đã thả {name}.",
		cancelled: "Đã huỷ di chuyển {name}.",
	},
	menu: {
		addRequest: "Thêm request",
		addFolder: "Thêm folder",
		rename: "Đổi tên",
		duplicate: "Nhân bản",
		share: "Chia sẻ",
		copyLink: "Sao chép link",
		move: "Chuyển workspace",
		export: "Export",
		delete: "Xoá",
	},
	toast: {
		created: "Đã tạo {name}.",
		favorited: "{name} giờ đứng đầu danh sách.",
		duplicated: "Đã nhân bản thành {name}.",
		linkCopied: "Đã sao chép link. Chỉ người có quyền mới mở được.",
		linkFailed: "Không sao chép được link. Hãy lấy link trong mục Chia sẻ.",
		exported: "Đã tải {file}.",
		exportFailed: "Không export được {name}.",
		moved: "Đã chuyển {name} sang {workspace}.",
		trashed: "Đã chuyển {name} vào thùng rác.",
		nodeDeleted: "Đã xoá {name}.",
		saved: "Đã lưu {name} vào {workspace}.",
	},
	deleteCollection: {
		title: "Xoá collection",
		body: {
			other: "“{name}” cùng {count} request sẽ vào thùng rác.",
		},
		bodyEmpty: "“{name}” sẽ vào thùng rác.",
		kept: {
			other:
				"Collection được giữ {count} ngày. Người có quyền có thể khôi phục trong thời gian này.",
		},
		typeLabel: "Gõ <code>{word}</code> để xác nhận",
		submit: "Xoá collection",
	},
	deleteNode: {
		folderTitle: "Xoá folder",
		requestTitle: "Xoá request",
		question: "Xoá “{name}”?",
		folderBody: {
			other:
				"Folder và {count} request bên trong bị xoá vĩnh viễn. Không hoàn tác được.",
		},
		requestBody: "Request bị xoá vĩnh viễn. Không hoàn tác được.",
		confirm: "Xoá",
	},
	move: {
		title: "Chuyển “{name}”",
		intro:
			"Thành viên của workspace đích có quyền theo vai trò của họ ở đó. Người được chia sẻ riêng vẫn giữ quyền.",
		legend: "Workspace đích",
		current: "Workspace hiện tại",
		teamToPersonal:
			"Collection của team không chuyển được về workspace cá nhân.",
		noAccess: "Bạn không thêm được collection vào đây.",
		personal: "Chỉ bạn thấy.",
		team: "Thành viên thấy theo vai trò.",
		submit: "Chuyển",
	},
	import: {
		modeLegend: "Import thành",
		tabs: "Mở thành tab",
		collection: "Lưu thành collection",
		collectionHint:
			"Lưu vào {workspace} cùng folder, auth, script và biến của nó.",
		submit: "Lưu collection",
	},
	fromMock: {
		title: "Collection từ project mock",
		intro:
			"Mỗi resource thành một folder chứa các request list, get, create, update và delete. Id bản ghi thành biến như <code>{example}</code>.",
		submit: "Tạo collection",
	},
	errors: {
		forbidden:
			"Vai trò của bạn không cho phép thao tác này. Hãy nhờ Admin hoặc Editor.",
		notFound: "Mục này không còn nữa hoặc bạn đã mất quyền truy cập.",
		teamToPersonal:
			"Collection của team không chuyển được về workspace cá nhân.",
		workspaceMissing: "Workspace của nó đã bị xoá. Hãy khôi phục từ thùng rác.",
		sameWorkspace: "Nó đã ở workspace đó rồi.",
		collectionLimit:
			"Workspace này đã chứa số collection tối đa. Hãy xoá bớt một collection trước.",
		nodesLimit:
			"Collection này đã chứa số folder và request tối đa. Hãy xoá bớt trước.",
		tooDeep: "Không lồng folder sâu hơn được nữa.",
		moveCycle: "Không đưa folder vào chính nó được.",
		moveFailed: "Không chuyển được tới đó. Hãy tải lại rồi thử lại.",
		tooLarge: "Nội dung quá lớn để lưu.",
		confirmation: "Gõ từ xác nhận để xoá.",
		invalid: "Có phần không hợp lệ nên chưa lưu được.",
		rateLimited: "Bạn thay đổi quá nhiều cùng lúc. Vui lòng đợi một chút.",
		fallback: "Không thực hiện được. Vui lòng thử lại.",
	},
	trash: collectionsTrash,
	...collectionsTabs,
};
