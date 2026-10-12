import type { Messages } from "../../message-types";

export const limits: Messages["limits"] = {
	reached: {
		projects: {
			other:
				"Tài khoản đã đạt giới hạn {count} project. Hãy xoá bớt một project để tạo project mới.",
		},
		resources: {
			other:
				"Các project của bạn đã đạt giới hạn tổng cộng {count} resource. Hãy xoá bớt một resource để thêm resource mới.",
		},
		webhookInboxes: {
			other:
				"Project đã đạt giới hạn {count} inbox. Hãy xoá bớt một inbox để thêm inbox mới.",
		},
		teamWorkspaces: "Tài khoản không tạo thêm được workspace nhóm.",
	},
	feedback: "Cần thêm? Hãy cho chúng tôi biết qua form góp ý.",
};
