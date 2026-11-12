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
			hint: "用此账号运行过 tunelo login 的机器会自动关联并显示在这里。只有你能看到它的隧道。",
			addSteps:
				"要添加机器，请在该机器上运行 Chat 页面中的安装命令，然后用 <code>{command}</code> 登录。机器会自动显示在这里。",
			openChat: "在 Chat 中打开“添加此机器”",
			empty: "尚未关联机器。",
			unnamed: "尚未打开隧道的机器",
			linkedAt: "关联于 {date}",
			revoke: "撤销 {name} 的关联",
			revoked:
				"已在该机器上撤销。请移除它，如有需要在机器上重新运行 tunelo login。",
		},
		machines: {
			badge: "你的机器",
			forward: "向 {name} 上的 localhost 发送请求",
			forwardHint:
				"发往 localhost 的请求通过这台机器自己的隧道到达它。只有你能使用。",
			pick: "选择 {name} 上的端口",
			pickTitle: "{name} 上的 localhost",
			pickHint:
				"选择机器上正在监听的端口，或手动输入。之后发往该 localhost 端口的请求会到达这台机器。",
			loading: "正在向机器查询端口…",
			noPorts: "没有正在监听的端口，或机器没有回应。你仍可手动输入。",
			portLabel: "端口",
			use: "使用 localhost:{port}",
			chosen:
				"localhost:{port} 现在会发往 {name}。已复制 http://localhost:{port}/",
			invalidPort: "请输入 1 到 65535 之间的端口。",
		},
	};
