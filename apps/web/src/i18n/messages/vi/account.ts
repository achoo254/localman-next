import type { Messages } from "../../message-types";

export const account: Messages["account"] = {
	title: "Tài khoản",
	limitsUntil: "Hạn mức mở rộng của bạn kéo dài tới {date}.",
	notificationChannels: "Kênh thông báo",
	usage: {
		loading: "Đang tải hạn mức…",
		loadFailed: "Không tải được hạn mức",
	},
	meters: {
		projects: "Projects",
		projectsNote: "Tính project bạn sở hữu, không tính project được mời.",
		mockRequests: "Request tới mock tháng này",
		mockNote: "Tính mọi request REST tới mock. Đặt lại ngày {date}.",
		mockNoteMcp: "REST và MCP đều tính. Đặt lại ngày {date}.",
		proxyRequests: "Request qua proxy tháng này",
		proxyNote:
			"Request gửi từ API client, kể cả qua Tunelo. Đặt lại ngày {date}.",
	},
	delete: {
		title: "Xoá tài khoản",
		body: "Xoá hẳn tài khoản Localman và dữ liệu của nó. Tài khoản đăng nhập {idpName} không bị ảnh hưởng.",
		learnMore: "Những gì bị xoá",
		open: "Xoá tài khoản…",
		question: "Xoá tài khoản Localman của bạn?",
		loading: "Đang kiểm tra những gì sẽ bị xoá…",
		loadFailed: "Không kiểm tra được những gì sẽ bị xoá",
		projects: {
			other: "{count} mock project bạn sở hữu, cùng dữ liệu của chúng",
		},
		sharedProjects: {
			other:
				"{count} project trong số đó đang được chia sẻ: thành viên cũng mất quyền truy cập",
		},
		workspaces: {
			other:
				"{count} workspace: workspace cá nhân và các team không còn thành viên nào khác",
		},
		collections: {
			other: "{count} collection trong đó, cùng các request",
		},
		leftWorkspaces: {
			other:
				"Bạn rời {count} workspace team; những gì bạn viết ở đó được giữ lại, không còn tên bạn",
		},
		everythingElse:
			"Lịch sử, tab đang mở, cài đặt, thông báo và mọi phiên đăng nhập cũng bị xoá.",
		irreversible: "Không thể hoàn tác.",
		blocked:
			"Bạn là Admin duy nhất của các workspace team dưới đây, nơi còn thành viên khác. Hãy cho một thành viên khác làm Admin, hoặc gỡ các thành viên khác, rồi thử lại:",
		idp: "Tài khoản {idpName} vẫn còn. Nếu muốn, hãy <idpDelete>xoá nó ở {idpName}</idpDelete>.",
		confirmLabel: "Gõ username <b>{username}</b> để xác nhận",
		confirm: "Xoá tài khoản",
	},
};
