import type { Messages } from "../../message-types";

export const resourceExport: Messages["resourceExport"] = {
	trigger: "Xuất type",
	triggerLabel: "Xuất type của {name}",
	copyTs: "Sao chép TypeScript",
	copyZod: "Sao chép Zod schema",
	download: "Tải <code>{file}</code>",
	savedOnly:
		"Xuất schema đã lưu. Bấm Cập nhật resource để có cả thay đổi của bạn.",
	copiedTs: "Đã sao chép type TypeScript của {name}.",
	copiedZod: "Đã sao chép Zod schema của {name}.",
	downloaded: "Đã tải {file}.",
	copyBlocked: "Trình duyệt chặn sao chép. Hãy dùng Tải thay thế.",
};
