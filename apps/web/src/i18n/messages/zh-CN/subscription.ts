import type { Messages } from "../../message-types";

export const subscription: Messages["subscription"] = {
	usage: {
		unlimited: "本月<b>不限次数</b>，仅有每秒速率限制。",
		valueText: "{used} / {max}",
		reached: "已达到额度。",
		usedPercent: "已使用 {percent}%。",
	},
	proInterest: {
		needs: {
			mock: "Mock API",
			apiClient: "API client",
			team: "团队",
			devopsCi: "DevOps/CI",
			mcp: "MCP",
			tunelo: "Tunelo",
		},
		teamSizes: {
			solo: "仅我一人",
			small: "2–5",
			medium: "6–20",
			large: "20 人以上",
		},
		priceHints: {
			unsure: "还不确定",
			lt100: "每月低于 100,000 越南盾",
			from100to250: "每月 100,000–250,000 越南盾",
			from250to500: "每月 250,000–500,000 越南盾",
			gt500: "每月高于 500,000 越南盾",
		},
		sources: {
			landing: "Landing · Pro 卡片",
			pricing: "价格表",
			subscriptionModal: "管理套餐",
			planLimitProjects: "Project 上限",
			planLimitResources: "Resource 上限",
			planLimitMembers: "成员上限",
			planLimitProxy: "Proxy 额度已用完",
			devops: "DevOps",
			account: "账号",
			elsewhere: "其他",
		},
	},
};
