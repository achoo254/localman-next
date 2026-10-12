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
};
