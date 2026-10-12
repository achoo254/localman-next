import type { Messages } from "../../message-types";

export const apiClientSend: Messages["apiClient"]["send"] = {
	preScriptFailed: "未发送：pre-request script 已停止。{reason}",
	secretWithheld:
		"未发送：它使用了 {name}，这是只有 Editor 能查看的 secret。请在 environment 中为它设置你自己的本地值，然后重新发送。",
	variablesUnavailable: "未发送：无法加载 environment 变量，请检查网络后重试。",
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
