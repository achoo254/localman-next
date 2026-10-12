import type { Messages } from "../../message-types";

export const limits: Messages["limits"] = {
	reached: {
		projects: {
			other: "此账户已达到 {count} 个 project 的上限。删除一个后才能创建新的。",
		},
		resources: {
			other:
				"你的所有 project 合计已达到 {count} 个 resource 的上限。删除一个后才能添加新的。",
		},
		webhookInboxes: {
			other:
				"此 project 已达到 {count} 个 inbox 的上限。删除一个后才能添加新的。",
		},
		teamWorkspaces: "此账户无法再创建团队 workspace。",
	},
	feedback: "需要更多？请通过反馈表告诉我们。",
};
