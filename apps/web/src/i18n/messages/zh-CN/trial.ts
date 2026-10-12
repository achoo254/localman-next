import type { Messages } from "../../message-types";

export const trial: Messages["trial"] = {
	overLimits: {
		title: "此账户已超出额度：{list}。",
		body: "所有内容照常运行；在回到额度以内之前，不能再新建。",
		separator: "、",
		projects: "{used}/{max} 个 project",
		resources: "{used}/{max} 个 resource",
	},
};
