import type { Messages } from "../../message-types";

export const account: Messages["account"] = {
	title: "Tài khoản",
	plan: {
		name: "Gói {plan}",
		nameExpires: "Gói {plan} · hết hạn {date}",
		limits: "{projects}, {resources}, {members}.",
		projects: { other: "{count} project" },
		resources: { other: "{count} resource mỗi project" },
		members: { other: "tối đa {count} thành viên mỗi project" },
		notificationChannels: "Kênh thông báo",
		manage: "Quản lý gói",
	},
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
