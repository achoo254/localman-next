import type { Messages } from "../../message-types";

export const apiClientTuneloAccounts: Messages["apiClientTunelo"]["accounts"] =
	{
		badge: "经由 Tunelo · {device}",
		basicAuth: "此隧道需要 Basic Auth",
		basicAuthBody:
			"请求的 Authorization 请求头已用于隧道的 Basic Auth，你的应用可能收不到它。",
		notice: {
			stopped: "{key} 的隧道已停止",
			stoppedBody: "重新运行 <code>{command}</code>，然后点击“重新发送”。",
			tcpOnly: "{key} 只有 TCP 隧道",
			tcpOnlyBody:
				"API 客户端只能发送 HTTP。请用 <code>{command}</code> 打开 HTTP 隧道。",
		},
		choose: {
			title: "为 {key} 选择隧道",
			body: "你有多个隧道服务此端口。请选择接收请求的隧道。",
			basicAuth: "Basic Auth",
			remember: "此选择会在本浏览器中为该地址记住。",
		},
		links: {
			title: "已关联的机器",
			hint: "在该关联方式停用之前用代码关联的机器。只有你能看到它们的隧道；不再使用的请移除。",
			unnamed: "尚未打开隧道的机器",
			linkedAt: "关联于 {date}",
			revoke: "撤销 {name} 的关联",
			revoked: "已在该机器上撤销。请移除它。",
		},
	};
