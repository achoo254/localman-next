import type { Messages } from "../../message-types";

export const resourceExport: Messages["resourceExport"] = {
	trigger: "导出类型",
	copyTs: "复制 TypeScript",
	copyZod: "复制 Zod schema",
	download: "下载 <code>{file}</code>",
	savedOnly: "导出的是已保存的 schema。更新 resource 后才会包含你的修改。",
	copiedTs: "已复制 {name} 的 TypeScript 类型。",
	copiedZod: "已复制 {name} 的 Zod schema。",
	downloaded: "已下载 {file}。",
	copyBlocked: "浏览器阻止了复制，请改用下载。",
};
