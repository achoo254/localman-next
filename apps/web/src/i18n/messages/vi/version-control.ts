import type { Messages } from "../../message-types";
import { versionControlPullRequests } from "./version-control-pull-requests";

export const versionControl: Messages["versionControl"] = {
	kinds: {
		collection: "collection",
		folder: "folder",
		request: "request",
		example: "example",
		environment: "environment",
		variable: "biến",
	},
	fork: {
		button: "Fork",
		count: { other: "{count} fork" },
		title: "Fork {name}",
		intro:
			"Fork là bản sao của riêng bạn, liên kết với {kind} này. Bạn sửa thoải mái, kéo thay đổi mới từ bản gốc và merge thay đổi của mình trở lại.",
		label: "Nhãn fork",
		labelHint: "Hiện cạnh tên để mọi người phân biệt các fork.",
		workspace: "Workspace",
		personalOnly:
			"Với vai trò Viewer của {kind} này, bạn chỉ fork được vào workspace cá nhân.",
		noWorkspace: "Không có workspace nào bạn được thêm vào.",
		submit: "Fork",
		done: "Đã fork {name}",
	},
	badge: {
		label: "Fork: {label}",
		from: "Fork từ {name}, do {person} tạo ngày {date}",
		sourceGone:
			"Do {person} fork ngày {date}. Bản gốc không còn, hoặc bạn không mở được nó.",
		rename: "Đổi nhãn fork",
		renameLabel: "Nhãn fork",
		save: "Lưu",
	},
	sync: {
		pull: "Kéo thay đổi",
		merge: "Merge",
		pullTitle: "Kéo thay đổi từ {name}",
		mergeTitle: "Merge vào {name}",
		pullIntro:
			"Đưa thay đổi của bản gốc vào fork này. Thay đổi của bạn được giữ; chỗ cả hai bên cùng sửa thì bạn chọn.",
		mergeIntro:
			"Gửi thay đổi của fork này sang bản gốc. Thay đổi riêng của bản gốc được giữ; chỗ cả hai bên cùng sửa thì bạn chọn.",
		nothing: "Không có gì để đưa sang: hai bên đã giống nhau.",
		changes: "Thay đổi",
		added: "Thêm {kind} {name}",
		removed: "Xoá {kind} {name}",
		changed: "Sửa {kind} {name}",
		option: "Sau khi merge",
		options: {
			merge: "Merge thay đổi",
			mergeAndUpdate: "Merge thay đổi rồi cập nhật fork này",
			mergeAndDelete: "Merge thay đổi rồi xoá fork này",
		},
		optionNeedsEditor: "Cần vai trò Editor ở fork này.",
		pullDone: "Đã kéo thay đổi từ {name}",
		mergeDone: "Đã merge vào {name}",
		followUpFailed:
			"Đã merge. Không cập nhật hoặc xoá được fork sau đó: hãy tự kéo thay đổi hoặc xoá nó.",
		submitPull: "Kéo thay đổi",
		submitMerge: "Merge",
		loading: "Đang so sánh hai bên…",
		loadFailed: "Không so sánh được hai bên.",
		sourceGone: "Bản gốc không còn, hoặc bạn không mở được nó.",
	},
	conflicts: {
		title: { other: "{count} xung đột" },
		intro:
			"Cả hai bên cùng sửa những chỗ này. Hãy chọn bản muốn giữ cho từng chỗ.",
		pullSides: "Nguồn là {name}; đích là fork này.",
		mergeSides: "Nguồn là fork này; đích là {name}.",
		keepSource: "Giữ bản nguồn",
		keepDestination: "Giữ bản đích",
		keepAllSource: "Giữ toàn bộ bản nguồn",
		keepAllDestination: "Giữ toàn bộ bản đích",
		deleted: "(đã xoá)",
		empty: "(trống)",
		whole: "toàn bộ {kind}",
		left: { other: "Còn {count} xung đột cần chọn" },
	},
	forks: {
		panel: "Fork",
		empty: "Chưa có fork nào.",
		by: "do {person} · {date}",
		open: "Mở {label}",
		openButton: "Mở",
		noAccess: "Bạn không mở được fork này.",
	},
	errors: {
		planFeature: "Fork và merge thuộc gói Pro.",
		target: "Với vai trò Viewer, bạn chỉ fork được vào workspace cá nhân.",
		conflicts: "Hãy chọn bản cho mọi xung đột trước.",
		sourceGone: "Bản gốc không còn, hoặc bạn không mở được nó.",
		forbidden: "Bạn không có quyền làm việc này.",
		notFound: "Pull request không còn, hoặc bạn không mở được nó.",
		closed: "Pull request này đã được merge hoặc bị từ chối.",
		invalidReviewer: "Người duyệt phải là Editor của bản gốc.",
		pullRequestLimit:
			"Một collection nhận tối đa 100 pull request đang mở. Hãy merge hoặc từ chối bớt trước.",
		busy: "Pull request này đang được thay đổi. Hãy thử lại.",
	},
	...versionControlPullRequests,
};
