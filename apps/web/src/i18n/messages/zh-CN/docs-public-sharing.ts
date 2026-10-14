import type { Messages } from "../../message-types";

/** `/docs/public-sharing`: 将 collection 分享到 workspace 之外。 */
export const docsPublicSharing: Messages["docs"]["publicSharing"] = {
	lead: "与 workspace 之外的人分享 collection:只读页面、供已登录访客使用的页面、给脚本用的 key,或放在 README 里的 Run in Localman 按钮。",
	ways: {
		title: "四种分享方式",
		body: "在 collection 上打开 <em>Share</em>。<em>Public</em> 可开启公开链接(任何持有链接的人无需登录即可阅读)和访客链接(已登录的人可以阅读并申请编辑权限)。<em>Keys</em> 用于创建只读 access key。<em>Run</em> 用于创建按钮,其他人点击后可将 collection 导入自己的 workspace。每个链接、key 或按钮都可以随时关闭。",
	},
	hidden: {
		title: "始终隐藏的内容",
		body: "<code>secret</code> 变量的值;在 collection、文件夹、请求和已保存示例的 Authorization 标签中直接填写的 token、密码和 API key;名称看起来像凭据的 header、query 参数和表单字段中直接填写的值(<code>Authorization</code>、<code>Cookie</code>、<code>Set-Cookie</code>、<code>X-API-Key</code>、<code>access_token</code>、<code>password</code>…);URL 中的 <code>user:password@</code>;以及所有已保存示例的响应体。<code>{{variable}}</code> 引用保持原样。本地值和未共享的 environment 值永远不会离开你的账户。",
	},
	kept: {
		title: "按原样公开的内容",
		body: "普通变量、请求体、脚本和 URL 路径会按原样公开。分享之前,Localman 会列出看起来像 secret 的值所在的位置(从不显示值本身),方便你先将其标记为 <code>secret</code> 或移到变量中。",
	},
	who: {
		title: "谁可以分享,以及如何停止",
		body: "workspace 中身份为 Admin 或 Editor 的成员可以分享其中的 collection;仅被单独分享某个 collection 的人不能分享。workspace 的 Admin 在 workspace 设置中有三个开关:公开链接(含公开 Run 按钮)、访客链接和 access key。关闭某个开关后,其涵盖的内容会立即停止。当 collection 被移入回收站,或创建者不再是该 workspace 的 Admin 或 Editor 时,链接也会停止。",
	},
	keys: {
		title: "Access key",
		body: "key 以 Collection v2.1 JSON 读取当前的 collection:<code>GET /api/v1/public/collections/<angle>collection id</angle>?access_key=<angle>key</angle></code>。key 只显示一次,60 天未使用后失效,也可以随时撤销。请像密码一样保管它:任何持有它的人都能读取该 collection。",
	},
	run: {
		title: "Run in Localman 按钮",
		body: "将 HTML 或 Markdown 复制到 README 中。点击按钮的人登录后选择自己的一个 workspace,即可导入 collection 的副本;如果你附加了 environment,还会带上其中已共享、非 secret 的值。团队按钮仅对你的 workspace 成员有效。脚本在导入者的浏览器中运行,因此公开按钮默认不导入脚本,除非对方主动选择。",
	},
};
