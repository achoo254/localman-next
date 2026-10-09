import type { Messages } from "../../message-types";
import { docsCustomResponses } from "./docs-custom-responses";
import { docsMcp } from "./docs-mcp";
import { docsQuickStart } from "./docs-quick-start";
import { docsReference } from "./docs-reference";

export const docs: Messages["docs"] = {
	documentTitle: "{page} · Localman 文档",
	toc: {
		label: "文档目录",
		heading: "文档",
	},
	pager: {
		label: "上一页和下一页",
		previous: "上一页",
		next: "下一页",
	},
	pages: {
		quickStart: {
			title: "快速开始",
			summary: "从空 project 到可调用的 API",
		},
		codeExamples: {
			title: "代码示例",
			summary: "fetch、axios 和 curl",
		},
		customResponses: {
			title: "Custom response",
			summary: "调整 response body 的结构",
		},
		mcp: {
			title: "MCP 工具",
			summary: "将 AI agent 连接到你的 mock",
		},
	},
	headerMethod: "Method",
	headerRoute: "路由",
	quickStart: docsQuickStart,
	reference: docsReference,
	codeExamples: {
		lead: "使用 fetch、axios 或 curl 调用 mock API：读取、写入、嵌套路由、分页和错误处理。",
		howToRead: "示例说明",
		intro:
			"示例使用 <code>customers</code> resource 以及嵌套在其中的 <code>orders</code> resource，包含 <code>product</code>、<code>quantity</code> 和 <code>paid</code> 三个 field。将 <angle>secret</angle> 替换为 project 的 API endpoint 卡片中的 secret。后面的代码块会复用第一个代码块中声明的 <code>BASE_URL</code>、<code>JSON_HEADERS</code> 和 <code>api</code>。",
		languageLegend: "示例语言",
		titles: {
			crud: "在扁平路由上读写",
			nested: "嵌套路由",
			pagination: "过滤、排序和分页",
			errors: "错误处理",
		},
		paginationNote:
			"列表默认只是记录数组。如需同时获取记录总数来绘制分页条，请参阅 Custom response 中的<countLink>带记录总数的列表</countLink>。所有参数都列在<queryLink>query 参数表</queryLink>中。",
		errorsNote:
			"每个 response 都带有 <code>X-Localman-Request-Id</code> header。另请参阅<statusLink>状态码与错误码表</statusLink>。",
	},
	customResponses: docsCustomResponses,
	mcp: docsMcp,
};
