import type { Messages } from "../../message-types";

export const apiClientOpen: Messages["apiClientOpen"] = {
	node: {
		label: "API Client",
		aria: "在 API Client 中打开 {name}",
	},
	project: {
		open: "在 API Client 中打开",
	},
	fromMock: {
		button: "从 mock project",
		title: "打开 mock project",
		intro:
			"每个 resource 已启用的 endpoint 都会打开为一个标签页：list、get、create、update 和 delete，包括嵌套的 resource。记录 id 会变成 <code>{example}</code> 这样的变量。",
		legend: "Mock project",
		loading: "正在加载 project…",
		loadFailed: "无法加载你的 project。",
		empty: "你还没有 mock project。请先在 Projects 中创建一个。",
		submit: "打开 request",
	},
	names: {
		list: "列出 {name}",
		get: "获取一条 {name}",
		create: "在 {name} 中创建",
		update: "替换 {name} 中的记录",
		patch: "更新 {name} 中的记录",
		delete: "从 {name} 中删除",
	},
	toast: {
		loadFailed: "无法打开 mock project",
		resourceMissing:
			"该 resource 已不在 project 中。请刷新 project 页面后重试。",
		noEndpoints: "该 project 还没有已启用的 endpoint。",
		truncated: "已打开 {opened} / {total} 个 request",
		truncatedBody:
			"最多只能同时打开 {max} 个标签页。请先关闭一些标签页，再重新打开 project 以打开其余部分。",
		full: "没有可用的标签页",
		fullBody: "最多只能同时打开 {max} 个标签页。请先关闭一些标签页。",
	},
};
