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
		connect: {
			title: "关联机器",
			opening: "正在获取代码…",
			body: "在运行隧道的机器上输入此代码：",
			command: "在那台机器上运行",
			waiting: "正在等待机器确认… 代码 10 分钟后过期。",
			linked: "机器已关联",
			linkedBody:
				"现在会为你的本地地址自动找到这台机器的隧道。你可以随时在这里撤销关联。",
			expired: "代码在机器使用前已过期。",
			restart: "获取新代码",
		},
		links: {
			title: "已关联的机器",
			hint: "用同一账号运行 tunelo login 后，会自动找到你 Tunelo 账号的隧道。没有账号的机器在这里关联；只有你能看到它的隧道。",
			add: "关联机器",
			empty: "尚未关联机器。",
			unnamed: "尚未打开隧道的机器",
			linkedAt: "关联于 {date}",
			revoke: "撤销 {name} 的关联",
			revoked: "已在该机器上撤销。请移除它，如有需要再重新关联。",
		},
	};
