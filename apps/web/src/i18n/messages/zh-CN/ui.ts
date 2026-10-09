import type { Messages } from "../../message-types";

export const ui: Messages["ui"] = {
	codeBlock: {
		copy: "复制 {caption} 代码",
		copiedNote: "已复制代码",
		failedNote: "无法复制，代码已选中，请手动复制。",
	},
	copyField: {
		defaultItem: "链接",
		copy: "复制{item}",
		copiedNote: "已复制{item}",
		autoFailedNote: "点击复制按钮复制{item}。",
		failedNote: "无法复制，请手动选中并复制{item}。",
	},
	toast: {
		region: "通知",
		close: "关闭通知",
	},
};
