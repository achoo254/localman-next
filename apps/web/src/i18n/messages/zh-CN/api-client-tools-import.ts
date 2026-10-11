import type { Messages } from "../../message-types";

export const apiClientToolsImport: Messages["apiClientTools"]["import"] = {
	title: "Import",
	intro:
		"粘贴 cURL 命令、Collection v2.1、environment 文件（v2.1）或 JSON 格式的 OpenAPI 3.x 文档，或选择文件。",
	text: "要导入的内容",
	placeholder: "curl -X GET 'https://api.example.com/users'",
	chooseFile: "选择文件",
	fileChosen: "{name}（{size}）",
	removeFile: "移除 {name}",
	reading: "正在读取文件…",
	readFailed: "无法读取文件，请重新选择。",
	idle: "还没有可导入的内容。",
	detecting: "正在检查格式…",
	detected: {
		other: "识别为 {format}：{count} 个 request。",
	},
	detectedEnvironment: {
		other: "识别为 environment 文件：{count} 个变量。",
	},
	formats: {
		curl: "cURL",
		"collection-v21": "Collection v2.1",
		openapi: "OpenAPI 3.x",
	},
	errors: {
		INPUT_TOO_LARGE: "内容超过 {max}，请拆分成更小的文件。",
		EMPTY_INPUT: "没有可导入的内容。请粘贴内容或选择文件。",
		INVALID_JSON: "内容不是有效的 JSON 或 cURL 命令，请检查后重试。",
		YAML_NOT_SUPPORTED: "暂不支持 YAML。请将文档转换为 JSON 后再导入。",
		UNKNOWN_FORMAT:
			"无法识别格式。请使用 cURL、Collection v2.1、environment 文件或 JSON 格式的 OpenAPI 3.x。",
		UNSUPPORTED_VERSION:
			"暂不支持 {version}。请使用 Collection v2.1 或 OpenAPI 3.x。",
		INVALID_CURL: "该 cURL 命令中没有要请求的 URL。",
		UNTERMINATED_QUOTE: "cURL 命令中有引号未闭合，请检查引号后重试。",
		INVALID_DOCUMENT: "文档在 {path} 处结构错误，请检查文件后重试。",
		TOO_COMPLEX: "文档嵌套过深或过大，无法导入。",
	},
	warningsTitle: {
		other: "本次导入有 {count} 条提示",
	},
	warnings: {
		UNSUPPORTED_OPTION: "cURL 选项 {option} 没有对应功能，已忽略。",
		UNSUPPORTED_AUTH: "不支持 auth 类型 {type}，已设为无 auth。",
		UNSUPPORTED_BODY: "不支持 body 类型 {mode}，已留空。",
		UNSUPPORTED_METHOD: "不支持 method {method}，已改用 GET。",
		FILE_NOT_INCLUDED: "文件 {name} 不在导入内容中，请重新选择。",
		SCRIPT_REVIEW:
			"有脚本使用了其他工具的 API。这里的脚本使用 <code>lm.*</code>，请检查。",
		TRUNCATED: "只导入了前 {max} 项。",
		EXTRA_URLS: "命令中还有 {count} 个 URL，只使用第一个。",
		UNRESOLVED_REF: "无法解析引用 {ref}，已跳过。",
		EXAMPLE_BODY_TRUNCATED: "某个 example 的 body 已被截断以符合大小限制。",
		INVALID_METADATA: {
			tags: "collection 的 tag 无效，已跳过。",
			status: "collection 的状态无效，已跳过。",
		},
		TEXT_TRUNCATED: "某个值已被截断为 {max} 个字符。",
		MORE_WARNINGS: "另有 {count} 条提示未列出。",
	},
	picker: {
		legend: "要打开的 request",
		selectAll: "全选",
		selectNone: "全不选",
		selected: "已选 {count}/{total}",
		capped: "一次最多打开 {max} 个标签页。",
	},
	submitRequests: {
		other: "打开 {count} 个 request",
	},
	submitEnvironment: "导入 environment",
	export: {
		trigger: "Export",
		label: "导出已打开的 request",
		collection: "Collection v2.1（.json）",
		openapi: "OpenAPI 3.0（.json）",
		environment: "Environment（.json）",
		downloaded: "已下载 {file}。",
		skipped: {
			other:
				"有 {count} 个 request 因 method 和 path 与其他 request 相同而被略过。",
		},
		secretsBlank: "文件中 secret 的值留空。",
		nothing: "打开一个 request 后即可导出。",
		defaultName: "Localman request",
	},
};
