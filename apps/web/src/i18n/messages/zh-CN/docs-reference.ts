import type { Messages } from "../../message-types";

export const docsReference: Messages["docs"]["reference"] = {
	queryParams: {
		caption: "列表路由的 query 参数",
		headerParam: "参数",
		headerEffect: "作用",
		headerExample: "示例",
		search:
			"在记录第一层的所有字符串值中（包括 <code>id</code>）查找子串，不区分大小写。两个都发送时，记录必须同时包含这两个字符串。",
		field:
			"按 schema 的某个 field、<code>id</code> 或 <code>{parentId}</code> 过滤。字符串 field 按子串匹配，不区分大小写；数字和布尔值按精确值匹配；<code>null</code> 匹配文字 <code>null</code>；<code>id</code> 和 <code>{parentId}</code> 按完整值匹配。多个 field 时记录必须全部匹配。不是 field 的名称会被忽略。",
		page: "页码，从 1 开始。仅在带有 <code>limit</code> 时生效。缺失或无效时为第 1 页。",
		limit:
			"每页记录数，最多 {max}（更大的数会被降为 {max}）。不发送时返回全部记录。",
		sort: '按某个 field 排序。数字以及只含数字的字符串按数值比较，因此 <code>"2"</code> 排在 <code>"10"</code> 之前。不存在的 field 会被忽略。',
		order: "<code>desc</code> 表示降序；默认升序。",
		reserved:
			"与保留参数同名的 field 无法用于过滤，因为 mock 会把该名称当作参数读取：{names}。如需按它过滤，请给 field 换个名称。",
	},
	statusCodes: {
		caption: "状态码与错误码",
		headerCode: "代码",
		headerWhen: "何时出现",
		none: "无",
		ok: "GET、PUT、PATCH 和 DELETE 成功。",
		created: "POST 已创建记录；body 为带 id 的新记录。",
		invalidQuery:
			"Query 参数名以 <code>$</code> 开头，包含 <code>.</code>、<code>[</code> 或 <code>]</code>，或者是 <code>__proto__</code>、<code>constructor</code>、<code>prototype</code>，或同一参数出现两次。",
		invalidJson:
			"Body 带有 <code>Content-Type: application/json</code>，但不是有效的 JSON。",
		validation:
			"Body 是 JSON 但不是 object，包含 <code>__proto__</code>、<code>constructor</code> 或 <code>prototype</code> key，或者通过扁平路由创建子记录时 <code>{parentId}</code> 未指向真实存在的父记录。嵌套超过 {depth} 层或包含超过 {nodes} 个值（每个 object、数组和单个值各算一个）的 body 也会以此代码被拒绝。",
		badRequest:
			"Request 在 body 发送完之前被中断，或服务器无法读取该 request。",
		unauthenticated:
			"仅出现在 MCP endpoint（<code>/mcp</code>），且 project 要求 MCP 使用 token 时：Bearer token 缺失或错误。REST 永远不会返回此代码。",
		notFoundText:
			"Secret 错误（格式正确）、prefix 错误、resource 或记录不存在、嵌套路由上的父记录不匹配、endpoint 已关闭，或该路由不提供此 method（例如向 <code>/:res/:id</code> 发送 POST）。Body 就是这个 JSON 字符串。",
		notFoundCode:
			"Secret 格式错误（只接受小写字母、数字和连字符，最多 63 个字符），因此 request 未指向任何 project。Body 采用通用错误格式：<code>{errorBody}</code>。",
		recordLimit: "该 resource 已有 {max} 条记录，达到上限。",
		dataTooLarge:
			"单条记录超过 {recordKb} KB，或 resource 的数据总量超过 {resourceMb} MB。",
		payloadTooLarge: "发送的 body 大于 {kb} KB。",
		unsupportedMediaType:
			"Body 使用了服务器无法读取的 <code>Content-Encoding</code> 或字符集；请发送未压缩的 UTF-8 JSON。",
		responseTooLarge:
			"返回的 body 将超过 {mb} MB；请用 <code>limit</code> 减少记录数。",
		rateLimited:
			"发送过快（按 IP 和按 project 限制）。等待 <code>Retry-After</code> header 中的秒数后再发送。",
		monthlyQuota: "Project 所有者已用完本月的 request 额度。",
		monthlyQuotaFree:
			"Project 所有者已用完本月的 request 额度（默认每月 {requests} 次 mock request，由其所有 project 共享）。",
		chaosError:
			"由 endpoint 的 chaos 设置（错误率）注入的错误，状态码为该设置中选择的状态码。",
		chaosTimeout:
			"由 endpoint 的 chaos 设置注入的超时：request 会等待到最大延迟（为 0 时为 10 秒），然后收到此响应。",
		requestCancelled:
			"仅限 Mock MCP：tool call 在等待 endpoint 的 chaos 延迟时被客户端关闭。tool 返回此错误，不会做任何更改。",
		internal:
			"服务器端错误。报告问题时请附上 <code>X-Localman-Request-Id</code>。",
	},
};
