import type { Messages } from "../../message-types";

export const collectionsChangelog: Pick<Messages["collections"], "changelog"> =
	{
		changelog: {
			title: "Changelog",
			intro:
				"Các thay đổi của cùng một người trong vòng 5 phút kể từ thay đổi đầu tiên được gom thành một session.",
			changes: {
				other: "{count} thay đổi",
			},
			viewDiff: "Xem diff",
			closeDiff: "Đóng diff",
			hide: "Ẩn diff",
			hideNote:
				"Ẩn diff này với viewer, editor vẫn xem được. Việc này không xoá dữ liệu khỏi lịch sử của collection.",
			irreversible:
				"Thay đổi này quá lớn để lưu trong changelog. Bạn sẽ không hoàn tác được nó, cũng không khôi phục được các thay đổi trước đó.",
			show: "Hiện diff",
			hidden: "Diff đã bị một editor ẩn.",
			hiddenFromViewers:
				"Diff này đang ẩn với viewer. Bạn vẫn xem được vì bạn là editor.",
			unavailable: "Thay đổi này quá lớn nên không giữ được diff.",
			diffFailed: "Không tải được diff này.",
			before: "Trước",
			after: "Sau",
			diffLabel: "Thay đổi của {name}",
			noChange: "Nội dung không có gì thay đổi.",
			unchangedLines: {
				other: "Hiện {count} dòng không đổi",
			},
			moreLines: {
				other: "Hiện thêm {count} dòng",
			},
			affected: {
				title: "Các mục bị thay đổi khi khôi phục",
				added: "Đã thêm {name}",
				removed: "Đã xoá {name}",
				changed: "Đã sửa {name}",
				unnamed: "một mục",
			},
			restore: "Khôi phục",
			restoreTitle: "Khôi phục về thay đổi này",
			restoreNeedsEditor: "Chỉ editor mới khôi phục được thay đổi.",
			restoreQuestion:
				"Khôi phục collection về trạng thái ngay sau thay đổi này?",
			restoreBody: "Việc này thêm một thay đổi mới; không mất gì cả.",
			restored: "Đã khôi phục collection.",
			editsDiscarded:
				"Các chỉnh sửa chưa lưu trên những trang đang mở đã bị bỏ để không ghi đè lên bản khôi phục.",
			unavailableRestore:
				"Không còn khôi phục được thay đổi này: một thay đổi sau đó quá lớn nên không được giữ, hoặc nó đã bị cắt bớt.",
			loadOlder: "Tải cũ hơn",
			loading: "Đang tải changelog…",
			empty: "Chưa có thay đổi nào.",
			loadFailed: "Không tải được changelog.",
			removedAccount: "Tài khoản đã xoá",
			viaMcp: "qua MCP",
			kinds: {
				collection: "collection",
				folder: "folder",
				request: "request",
				example: "example",
			},
			describe: {
				create: "Đã tạo {kind} {name}",
				update: "Đã sửa {fields} của {kind} {name}",
				rename: "Đã đổi tên {kind} {name}",
				move: "Đã di chuyển {kind} {name}",
				delete: "Đã xoá {kind} {name}",
				trash: "Đã chuyển collection vào thùng rác",
				untrash: "Đã khôi phục collection từ thùng rác",
				restore: "Đã khôi phục collection về một thay đổi trước đó",
				merge: "Đã merge thay đổi từ fork {name}",
				pull: "Đã kéo thay đổi từ {name}",
				sync: "Đã đồng bộ với project mock {name}",
			},
			fields: {
				name: "tên",
				description: "mô tả",
				auth: "auth",
				scripts: "script",
				draft: "request",
				variables: "biến",
				tags: "tag",
				status: "trạng thái",
				order: "vị trí",
				parentId: "nơi chứa",
				request: "request",
				response: "response",
			},
		},
	};
