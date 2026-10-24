import type { Messages } from "../../message-types";

export const dataTransparency: Messages["dataTransparency"] = {
	nav: "你的数据",
	title: "你的数据存放在哪里",
	intro:
		"{app} 在你的设备上保留什么、什么会到达服务器以及保留多久、记录哪些日志。本页的保留时长和日志字段来自应用实际运行的同一份配置。",
	promise: {
		title: "Secret 不离开浏览器",
		body: "Secret 变量的个人值在浏览器中用只有你知道的口令加密，服务器只保存密文。只要浏览器能发送，请求就直接从浏览器发往你调用的 API。当 {app} 要自行把一个带有 secret 或凭据的请求转到它的代理时，会先询问你。",
		exceptions:
			"例外情况，都由你决定：你通过代理发送的请求（标签页设为 Proxy、你始终允许的主机，或发送失败后点“通过代理发送”）会带着其中的 secret 经过服务器；你允许 agent 使用的 secret 会以加密形式复制到服务器，仅用于你列出的主机；secret 变量的共享值用服务器的密钥加密，以便你共享的人可以使用。",
	},
	places: {
		device: "你的设备",
		serverSealed: "服务器，已封存",
		serverEncrypted: "服务器，已加密",
		server: "服务器",
		passing: "仅经过",
	},
	table: {
		caption: "API 客户端的数据、存放位置与保留时长",
		data: "数据",
		where: "位置",
		kept: "保留",
	},
	kept: {
		neverSent: "从不发送",
		untilDeleted: "直到你删除",
		notStored: "不保存",
		days: { one: "{count} 天", other: "{count} 天" },
		daysByLimits: "{standard} 天，扩展额度下 {extended} 天",
		cap: "最多 {count} 条",
	},
	items: {
		vaultPassphrase: {
			title: "保险库口令与密钥",
			detail:
				"只在浏览器中输入。密钥保存在此浏览器的存储中，从不发送。忘记口令，由它封存的值就会丢失。",
		},
		vaultValues: {
			title: "Secret 变量的个人值",
			detail:
				"保存前在浏览器中封存。服务器保存与变量名和作用域绑定的密文，且无法打开。在你创建保险库之前保存的值仍用服务器密钥加密，直到保险库首次打开时才移入其中。",
		},
		directSends: {
			title: "直接发送的请求",
			detail:
				"从浏览器发往你调用的 API。填入变量后的请求和响应从不到达 {app}；历史记录只保留其所在行列出的内容。",
		},
		proxySends: {
			title: "经代理发送的请求",
			detail:
				"当浏览器无法按原样发送请求（被浏览器拒绝的请求头、未开启 CORS 的 API）或你选择代理时，{app} 服务器代你发送并把响应传回，两者都不保存。发往你本机应用的请求还会经过 Tunelo 隧道，其 Web 服务器会记录路径和查询参数。",
		},
		agentCopies: {
			title: "你允许 agent 使用的 secret",
			detail:
				"仅限你开启“允许 agent 使用”的变量：一份用服务器密钥加密的副本，只填入发往你列出主机的请求。{app} 从不向 agent 展示它，并在回答中遮盖它；短于 4 个字符的值，或被 API 改写后再返回的值，可能无法遮盖。",
		},
		sharedSecrets: {
			title: "Secret 变量的共享值",
			detail: "用服务器密钥加密，以便你共享的人可以使用。只读成员永远收不到。",
		},
		variables: {
			title: "其他变量",
			detail: "按你的设置保存在你的工作区中。",
		},
		collections: {
			title: "集合、请求和示例",
			detail: "保存下来，便于你随处打开和共享。",
		},
		requestTabs: {
			title: "打开的请求标签页",
			detail:
				"按你的写法保存，<code>{token}</code> 保持未填入；直接输入（而非通过变量）的凭据按输入原样保存。",
		},
		history: {
			title: "请求历史",
			detail:
				"每个请求按原写法保存，<code>{token}</code> 保持未填入，直接输入的凭据被清空，并记录响应的状态、耗时和大小，以及重定向后的最终位置（不含查询参数）；从不保存响应的请求头或正文。",
		},
		mockLogs: {
			title: "Mock 请求日志",
			detail:
				"发往你的 mock API 的请求及其响应，包括查询参数、请求头和正文；Authorization、Cookie、Set-Cookie、X-API-Key 请求头以及你选择隐藏的请求头保存为“[redacted]”。",
		},
		backups: {
			title: "每晚备份",
			detail:
				"整个数据库的备份，位于同一台服务器：已删除的数据可能保留在某份备份中，直到它被轮换掉。",
		},
	},
	fieldLine: "<code>{field}</code>：{label}",
	proxyLog: {
		title: "代理记录什么",
		body: "每个请求一行，只有以下字段。从不记录路径、查询参数、请求头或正文。",
		fields: {
			sub: "你的账户 ID",
			host: "目标主机，mock API 的 secret 标签被遮盖",
			method: "方法",
			status: "响应状态",
			error: "或错误代码",
			ms: "耗时",
			via: "本地目标经过的隧道",
		},
	},
	serverLog: {
		title: "服务器记录什么",
		body: "发往 {app} 的每个请求一行，只有以下字段。从不记录请求头、cookie、正文或查询参数。服务器出错时会另加一行错误信息。",
		fields: {
			requestId: "用于再次找到该行的 ID",
			method: "方法",
			route: "路由模板；mock API 则为其路径，项目的 secret 被遮盖",
			status: "响应状态",
			ms: "耗时",
			projectId: "请求涉及的 mock 项目",
			aborted: "客户端中途断开时标记",
		},
	},
	webServerLog: {
		title: "Web 服务器记录什么",
		body: "{app} 前面的 Web 服务器每个请求写一行，只有以下字段。从不记录主机名、查询参数、cookie 或来源页面。",
		fields: {
			ip: "你的 IP 地址",
			time: "时间",
			method: "方法",
			path: "路径，查询参数被隐藏",
			status: "响应状态",
			bytes: "响应大小",
			userAgent: "浏览器名称和版本",
			duration: "耗时",
		},
	},
	telemetry: {
		title: "遥测",
		body: "没有。{app} 不使用任何分析、跟踪或错误上报服务，也不展示广告。",
	},
	more: "<privacy>隐私政策</privacy>说明了你的账户、登录以及涉及的其他服务。",
	landing: {
		eyebrow: "隐私",
		title: "Secret 不离开浏览器",
		lead: "Secret 变量的个人值在浏览器中用只有你知道的口令加密，只要浏览器能发送，请求就直接从浏览器发出。如果 {app} 要自行把带有 secret 的请求转到它的代理，会先询问你。",
		points: {
			sealed: "服务器只保存它无法打开的密文。",
			direct: "直接发送的请求从不经过 {app} 服务器。",
			agents: "Agent 只在你允许的地方使用 secret；{app} 从不向它们展示。",
		},
		link: "你的数据存放在哪里",
	},
};
