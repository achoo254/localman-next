import type { Messages } from "../../message-types";

export const apiClientToolsSnippet: Messages["apiClientTools"]["snippet"] = {
	title: "代码片段",
	language: "语言",
	resolved: "变量已替换为当前值。分享前请检查代码。",
	secrets: "代码中以明文包含 secret 变量 {names} 的值。",
	unresolved: "这些变量没有值，保持原样：{names}。",
	bodyOmitted: "Body 是文件，未包含在代码中，请在你的代码中自行附加。",
	failed: "无法为此 request 生成代码。",
};
