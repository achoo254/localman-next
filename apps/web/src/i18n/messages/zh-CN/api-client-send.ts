import type { Messages } from "../../message-types";

export const apiClientSend: Messages["apiClient"]["send"] = {
	preScriptFailed: "未发送：pre-request script 已停止。{reason}",
	secretWithheld:
		"未发送：它使用了 {name}，这是只有 Editor 能查看的 secret。请在 environment 中为它设置你自己的本地值，然后重新发送。",
	scopesDropped:
		"脚本设置了 {scopes} 的值，但无处保存：没有已激活的 environment，或 request 不属于任何 collection。",
	scopeNames: { environment: "environment", collectionVariables: "collection" },
	scopesNotSaved:
		"已收到 response，但脚本设置的变量未能保存。请重新发送以重试。",
	dynamicVariablesUnavailable:
		"未发送：无法加载随机值（$random…），请检查网络后重试。",
	variablesUnavailable: "未发送：无法加载 environment 变量，请检查网络后重试。",
	sourceFailed: "未发送：此 request 依赖的另一个 request 没有收到 response。",
	references: {
		REFERENCE_OUTSIDE_COLLECTION:
			"未发送：response 引用 只能用在已保存到 collection 的 request 中。",
		REFERENCE_REQUEST_NOT_FOUND:
			"未发送：此 collection 中没有名为“{name}”的 request 供 response 引用 使用。",
		REFERENCE_LOOP:
			"未发送：“{name}”需要正在发送的 request 的 response，形成了循环。",
		REFERENCE_TOO_DEEP:
			"未发送：response 引用 串联的 request 太多（最多 5 个）。",
		REFERENCE_SEND_FAILED:
			"未发送：response 引用 所需的 request {name} 没有收到 response。",
		REFERENCE_NOT_JSON:
			"未发送：“{name}”的 response 不是 JSON，无法读取 {path}。",
		REFERENCE_PATH_INVALID:
			"未发送：{path} 不是 $.token 或 $.items[0].id 这样的 JSONPath。",
		REFERENCE_PATH_MISSING:
			"未发送：“{name}”的 response 在 {path} 处没有内容。",
	},
	fileUnreadable: "无法读取 body 中的文件，请重新选择。",
	prepare: {
		invalidUrl:
			"请输入完整的 http 或 https URL，例如 https://api.example.com/users。",
		invalidHeaderName: "Header “{name}”的名称中有不允许的字符。",
		invalidHeaderValue: "Header “{name}”的值中有换行符。",
		fileMissing: "请重新选择文件“{name}”：重新加载后不会保留文件。",
		bodyTooLarge: "Body 超过 10 MB，超出单个 request 的上限。",
	},
	script: {
		SCRIPT_ERROR: "Script 抛出了错误。",
		SCRIPT_TOO_LONG: "Script 太长。",
		SCRIPT_TIMEOUT: "Script 运行时间过长，已被停止。",
		SCRIPT_MEMORY_LIMIT: "Script 占用内存过多。",
		SCRIPT_STACK_OVERFLOW: "Script 调用嵌套过深。",
		SCRIPT_UNAVAILABLE: "无法加载 script 沙箱，请检查网络后重试。",
		SCRIPT_INTERNAL: "Script 沙箱出错，请重试。",
		atLine: "{reason}（第 {line} 行）",
	},
};
