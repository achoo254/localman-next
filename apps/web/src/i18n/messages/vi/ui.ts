import type { Messages } from "../../message-types";

export const ui: Messages["ui"] = {
	codeBlock: {
		copy: "Sao chép mã {caption}",
		copiedNote: "Đã sao chép mã",
		failedNote:
			"Không sao chép được, mã đã được chọn để bạn sao chép thủ công.",
	},
	copyField: {
		defaultItem: "link",
		copy: "Sao chép {item}",
		copiedNote: "Đã sao chép {item}",
		autoFailedNote: "Bấm nút sao chép để copy {item}.",
		failedNote: "Không sao chép được, hãy chọn {item} và sao chép thủ công.",
	},
	toast: {
		region: "Thông báo",
		close: "Đóng thông báo",
	},
};
