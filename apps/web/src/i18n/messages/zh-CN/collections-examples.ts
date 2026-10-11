import type { Messages } from "../../message-types";

type Part = Pick<Messages["collections"], "example" | "bulk">;

export const collectionsExamples: Part = {
	example: {
		response: "Response",
		status: "状态码",
		statusInvalid: "请使用 100 到 599 之间的状态码。",
		statusText: "状态文本",
		language: "Body 语言",
		headers: "Response header",
		addHeader: "添加 header",
		body: "Response body",
		note: "Example 是此 request 已保存的 response，用于说明 request，发送时不会使用。",
		gone: "此 example 已不存在，请关闭它的标签页。",
		cut: "Body 过长，保存前已截断。",
		saveFromResponse: "保存为 example",
		saved: "已保存 example {name}。",
	},
	bulk: {
		selected: {
			other: "已选 {count} 项",
		},
		clear: "取消选择",
		delete: "删除",
		bar: "已选项目",
		title: "删除所选项目",
		collections: {
			other: "{count} 个 collection 将移到回收站。",
		},
		nodes: {
			other: "{count} 个 folder、request 或 example 将被永久删除。",
		},
		confirm: "删除",
		done: {
			other: "已删除 {count} 项。",
		},
		partial: "已删除 {done}/{total} 项。{reason}",
	},
};
