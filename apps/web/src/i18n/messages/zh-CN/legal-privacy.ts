import type { Messages } from "../../message-types";

export const legalPrivacy: Messages["legalPrivacy"] = {
	title: "隐私政策",
	intro:
		"Localman（位于 {appHost} 的网页应用、其 mock API 和 MCP endpoint）帮助你构建 mock API 并发送 API request。本政策说明 Localman 存储哪些数据、用途、还有谁会收到、保留多久，以及你可以如何处理。“我们”指 Localman 的运营者。",
	collect: {
		title: "我们存储什么",
		body: "- <b>你的账号：</b>你登录时以及保持登录期间 {idpName} 账号提供的信息：账号 ID、用户名、显示名称、头像链接、邮箱地址及其是否已验证，以及你在那里关联的 Telegram 聊天（如有）。还包括你账号适用的额度、扩展额度的截止时间以及界面语言。Localman 不保存你的密码。\n- <b>登录会话：</b>一个会话 cookie，以及服务器上该会话的登录 token（已加密）。\n- <b>你创建的内容：</b>mock project、resource 及其数据、规则、webhook inbox 和 callback；API client 的 collection、request、example、environment 和变量（secret 值已加密）、评论、fork 和 pull request；你打开的 request 标签页、历史和设置。\n- <b>Mock request 日志：</b>针对你的 mock API 和 webhook inbox 的 request：时间、method、path、query、status、耗时，以及 request 和 response 的 header 与 body。body 截断为 64 KB；Authorization、Cookie、Set-Cookie、X-API-Key header 以及你选择隐藏的 header 存储为“[redacted]”。\n- <b>API client 历史：</b>按你编写的样子保存每个 request，变量保留为占位符而非其值，以及 response 的 status、耗时和大小；不包括 response 的 header 和 body。\n- <b>用量计数：</b>每月的 mock 和 proxy request 数，用于额度。\n- <b>通知：</b>发送给你的通知、你的通知设置，以及在你开启 Web Push 时每个浏览器的推送地址。\n- <b>反馈和联系表单：</b>你的留言，以及你填写的姓名和用于回复的邮箱或 Telegram 用户名；如果你已登录，还包括你的账号。\n- <b>已关联的 Tunelo 设备：</b>关联 token（已加密）和设备名称。\n- <b>技术日志：</b>对服务器的每个 request：request ID、method、路由、status 和耗时；从不记录 header、cookie、body 或 query string。通过 API client proxy 发送的 request 还会记录你的账号 ID 和目标主机。\n- <b>频率限制：</b>以你的 IP 地址段或账号的哈希为键的计数器，时间窗口结束后删除。\n\nLocalman 没有广告，也不使用任何分析或追踪工具。浏览器会在你设备的 local storage 中保存你的语言、主题和部分应用状态（打开的页面、排序方式、选择的 tunnel）。",
	},
	purposes: {
		title: "我们为何使用这些数据",
		body: "- 运行你使用的功能：提供你的 mock API、发送你的 request、与你邀请的人共享、通过你选择的渠道通知你。\n- 执行用量额度和频率限制，阻止滥用。\n- 保障账号安全，查找并修复错误。",
	},
	processors: {
		title: "还有谁会收到数据",
		body: "- <b>{idpName} 账号服务</b>（<idp>{idpHost}</idp>）：为你登录，并向 Localman 发送上述账号信息。它是独立的服务，有自己的账号页面。\n- <b>Cloudflare</b>：为 Localman 提供 DNS，并承载网页应用和 dashboard API 的流量。你未登录提交表单时，Cloudflare Turnstile 会检查你不是机器人。对 mock API 子域名的 request 不经过 Cloudflare。<cloudflare>Cloudflare 隐私政策</cloudflare>。\n- <b>Telegram</b>：仅当你开启 Telegram 通知时，通知内容才会通过 Telegram 的 bot API 发送到你关联的聊天。任何人提交反馈表单时，一段简短摘录（最多 300 个字符）和已遮盖的联系地址会发送到运营者的 Telegram 聊天。<telegram>Telegram 隐私政策</telegram>。\n- <b>你浏览器的推送服务</b>（由浏览器厂商提供）：仅当你开启 Web Push 时，它会把通知送达你的设备。\n- <b>Tunelo</b>（<tunelo>{tunnelHost}</tunelo>）：仅当你在 Localman 中使用 Tunelo 时，Localman 会读取你的 tunnel 列表，并通过你的 tunnel 向本地应用发送 request。\n- <b>你指定的地址：</b>你通过 API client proxy、mock upstream、callback 和 inbox 转发发送的 request，会按你设置的内容发往你设置的地址。",
	},
	location: {
		title: "数据存放位置",
		body: "位于 {appHost} 的 Localman 服务器设在越南，你的数据存储在那里；上面列出的服务可能按其自身政策在其他地方处理数据。",
	},
	retention: {
		title: "我们保留多久",
		body: "- <b>账号、project、collection 和设置：</b>直到你删除它们或删除账号。\n- <b>Mock request 日志：</b>标准额度下 7 天，享有扩展额度期间 30 天，且每个 project 最多保留最新的 20,000 条。\n- <b>API client 历史：</b>90 天，最多 500 条。\n- <b>通知：</b>90 天。\n- <b>会话：</b>30 天未使用即结束，最长 90 天。\n- <b>已删除的 collection：</b>在回收站保留 30 天。\n- <b>反馈和联系消息：</b>直到运营者删除。\n- <b>无活动的 project：</b>所有者处于标准额度时，90 天无活动的 project 可能会被运营者删除。\n- <b>备份：</b>数据库每晚备份，服务器上保留最近 14 份，因此已删除的数据最多可能在备份中保留 14 天。",
	},
	rights: {
		title: "你可以做什么",
		body: "- <b>查看和导出：</b>将 collection 和 environment 导出为文件；在应用中查看你的 request 日志和历史。\n- <b>修改和删除：</b>随时编辑或删除你的 project、数据、collection、environment、历史和评论。\n- <b>通知：</b>按事件选择通知渠道，或全部关闭。\n- <b>删除账号：</b>在账号页面的“删除账号”中操作。<accountDelete>删除会移除哪些内容</accountDelete>。你的 {idpName} 登录账号需单独删除，请前往<idpDelete>其账号页面</idpDelete>。\n- 其他关于数据的请求：见下方的联系方式。",
	},
	security: {
		title: "安全",
		body: "连接使用 HTTPS。会话 cookie 无法被脚本读取。登录 token、secret 变量值和 Tunelo 关联 token 均加密存储；邀请 token、access key 和 MCP token 仅以哈希形式存储。没有任何系统是绝对安全的。",
	},
	changes: {
		title: "变更",
		body: "本政策变更时，页面顶部的日期会随之更新。",
	},
};
