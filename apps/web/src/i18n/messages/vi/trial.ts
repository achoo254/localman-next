import type { Messages } from "../../message-types";

export const trial: Messages["trial"] = {
	overLimits: {
		title: "Tài khoản đang vượt hạn mức: {list}.",
		body: "Mọi thứ vẫn chạy bình thường; bạn chỉ không tạo thêm được cho tới khi về dưới hạn mức.",
		separator: ", ",
		projects: "{used}/{max} project",
		resources: "{used}/{max} resource",
	},
};
