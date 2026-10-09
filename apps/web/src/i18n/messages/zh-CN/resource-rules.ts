import type { Messages } from "../../message-types";

export const resourceRules: Messages["resourceRules"] = {
	toggle: "规则",
	toggleCount: { other: "规则 · {count}" },
	toggleLabel: "{endpoint} 的规则",
	intro:
		"当 request 匹配条件时返回不同的 response。规则从上到下执行，使用第一条匹配的规则。",
	empty: "还没有规则。没有规则时，这个 endpoint 返回它的 response template。",
	add: "添加规则",
	limit: "每个 endpoint 最多 {max} 条规则。",
	limitReached: "这个 endpoint 已有 {max} 条规则，已达上限。",
	title: "规则 {position}",
	toggleRule: "规则 {position}：{summary}",
	incomplete: "规则未填写完整",
	checkRule: "请检查这条规则",
	when: "当",
	respond: "返回",
	source: "匹配对象",
	sources: {
		header: "Header",
		query: "Query 参数",
		body: "Body（JSONPath）",
		nth: "第 N 个 request",
	},
	summarySources: {
		header: "header",
		query: "query",
		body: "body",
		nth: "第 N 个 request",
	},
	target: {
		header: "Header 名称",
		query: "参数名",
		body: "JSONPath",
	},
	op: "条件",
	ops: {
		eq: "等于",
		neq: "不等于",
		contains: "包含",
		regex: "匹配正则",
		exists: "存在",
		gt: "大于",
		lt: "小于",
	},
	value: "值",
	fieldOf: "规则 {position} 的{field}",
	headerHint: "Header 名称不区分大小写。",
	nthHint:
		"统计发往这个 endpoint 的 request，从 1 开始。保存 resource 后重新计数。",
	status: "状态码",
	headers: "Header（可选）",
	headersHint:
		"由 header 名称和文本值组成的 JSON 对象，例如 <code>{example}</code>。",
	body: "Body template（可选）",
	bodyHint:
		'可使用与 response template 相同的变量。留空则返回 <code>"$mockData"</code>。',
	moveUp: "上移规则 {position}",
	moveDown: "下移规则 {position}",
	remove: "删除规则 {position}",
	moved: "规则已移到第 {position} 位，共 {count} 条。",
	removed: "已删除规则 {position}。",
	errors: {
		keyRequiredHeader: "请输入 header 名称。",
		keyRequiredQuery: "请输入参数名。",
		headerName: "Header 名称只能包含字母、数字和 -，例如 <code>x-role</code>。",
		jsonPath:
			"请输入以 <code>$</code> 开头的 JSONPath，例如 <code>$.user.role</code>。",
		valueRequired: "请输入值。",
		number: "请输入用于比较的数字。",
		nth: "请输入从 1 开始的整数。",
		regex: "这个正则无效，请检查括号和转义字符。",
		regexUnsafe:
			"这个正则可能让 mock 变慢。不要重复分组，不要使用反向引用或前后断言，并且只使用一个 <code>+</code> 或 <code>*</code>。",
		tooLong: "最多 {max} 个字符。",
		status: "请输入 {min} 到 {max} 之间的状态码。",
		headers: "Header 必须是值为文本的 JSON 对象。",
		headersMax: "每条规则最多设置 {max} 个 header。",
		headerReserved:
			"规则不能设置 <code>{name}</code>。请使用你自己的 <code>x-…</code> header，或 <code>cache-control</code>、<code>etag</code>、<code>retry-after</code> 等。",
		headerLocation:
			"<code>location</code> 只能与 3xx 状态码一起使用，例如 301 或 302。",
		headerContentType:
			"<code>content-type</code> 必须是 JSON 类型（<code>application/json</code>、<code>application/…+json</code>）或 <code>text/plain</code>。",
		headerValue:
			"<code>{name}</code> 的值必须是单行纯文本，最多 {max} 个字符。",
		server: "未被接受：{message}",
	},
};
