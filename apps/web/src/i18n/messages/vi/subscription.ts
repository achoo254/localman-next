import type { Messages } from "../../message-types";

export const subscription: Messages["subscription"] = {
	usage: {
		unlimited:
			"<b>Không giới hạn</b> trong tháng, chỉ có rate-limit theo giây.",
		valueText: "{used} trên {max}",
		reached: "Đã đạt hạn mức.",
		usedPercent: "Đã dùng {percent}%.",
	},
	proInterest: {
		needs: {
			mock: "Mock API",
			apiClient: "API Client",
			team: "Team",
			devopsCi: "DevOps/CI",
			mcp: "MCP",
			tunelo: "Tunelo",
		},
		teamSizes: {
			solo: "1 người",
			small: "2–5",
			medium: "6–20",
			large: "Trên 20",
		},
		priceHints: {
			unsure: "Chưa rõ",
			lt100: "Dưới 100.000đ mỗi tháng",
			from100to250: "100.000–250.000đ mỗi tháng",
			from250to500: "250.000–500.000đ mỗi tháng",
			gt500: "Trên 500.000đ mỗi tháng",
		},
		sources: {
			landing: "Landing · thẻ Pro",
			pricing: "Bảng giá",
			subscriptionModal: "Quản lý gói",
			planLimitProjects: "Giới hạn project",
			planLimitResources: "Giới hạn resource",
			planLimitMembers: "Giới hạn thành viên",
			planLimitProxy: "Hết quota proxy",
			devops: "DevOps",
			account: "Tài khoản",
			elsewhere: "Khác",
		},
	},
};
