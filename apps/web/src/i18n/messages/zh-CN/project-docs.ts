import type { Messages } from "../../message-types";

export const projectDocs: Messages["projectDocs"] = {
	publish: {
		button: "Docs",
		title: "公开 docs",
		intro:
			"此项目 resource、field 和 endpoint 的 docs，始终与当前一致。任何拥有链接的人无需登录即可阅读。",
		toggle: "发布 docs",
		toggleHint:
			"docs 中不包含 mock URL：path 从 {baseUrl} 开始，由你自行分享。关闭后链接将失效。",
		link: "docs 链接",
	},
	page: {
		pageTitle: "API docs",
		badge: "由 mock 生成",
		intro:
			"这些 docs 与 mock 当前的 resource 保持一致。path 从 mock 的 base URL 开始，由项目所有者与你分享。",
		endpoints: "Endpoint",
		fields: "Field",
		field: "Field",
		type: "类型",
		detail: "详情",
		example: "示例记录",
		empty: "此项目还没有 resource。",
		notFoundTitle: "这些 docs 未发布",
		notFoundText: "链接有误，或项目已撤下其 docs。",
	},
};
