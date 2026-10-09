import type { Messages } from "../../message-types";

export const docsCustomResponses: Messages["docs"]["customResponses"] = {
	lead: "修改每个 endpoint 返回的 body 结构，例如把列表包装进一个带记录总数的 object，或者直接关闭某个 endpoint。",
	default: {
		title: "默认",
		body: '每个 endpoint 都有一个 response template。默认 template 是字符串 <code>"$mockData"</code>，即 body 就是数据本身：列表 GET 返回数组，单条 GET 返回 object，POST 返回新记录，PUT 和 PATCH 返回修改后的记录，DELETE 返回被删除的记录。',
	},
	edit: {
		title: "编辑 template",
		body: "在 resource 上点击“编辑”。Endpoints 部分列出五个 endpoint，每个都有开关和接收 JSON 的 Response template 输入框。点击“更新”保存；下一个 request 立即使用新 template。",
		bodyWithFree:
			"在 resource 上点击“编辑”。Endpoints 部分列出五个 endpoint，每个都有开关和接收 JSON 的 Response template 输入框。点击“更新”保存；下一个 request 立即使用新 template。所有套餐（包括 Free）都可使用 custom response。",
	},
	variables: {
		title: "Template 变量",
		caption: "Response template 的三类变量",
		headerVariable: "变量",
		headerValue: "值",
		mockData:
			"没有 template 时 endpoint 返回的数据：列表 GET 为记录数组（已过滤、排序、分页），其他 endpoint 为单条记录。",
		count:
			"记录数。在列表 GET 中是符合过滤条件的记录数，在分页前计算。在其他 endpoint 中是路由对应集合的记录数，在写入后计算（嵌套路由上只计算该父记录下的子记录）。",
		faker:
			"每次 request 都会新生成的 Faker 值，例如 {examples}。Schema 的 Faker 选择框中的所有方法都可使用。",
		wholeString:
			'只有<em>整个字符串</em>是变量时才会被替换：<code>"你好 $name.firstName"</code> 会原样保留。数字、布尔值、普通字符串、嵌套的 object 和数组保持不变；object 深处的变量依然会被替换。不存在的变量（例如拼错的 <code>"$mockdata"</code>）在保存时就会被拒绝。',
	},
	count: {
		title: "带记录总数的列表",
		body: "这个 template 让列表 GET endpoint 返回当前页数据和记录总数，足以绘制分页条：",
		templateCaption: "GET /customers 的 template",
		responseCaption: "GET /customers?page=2&limit=10（精简为 2 条记录）",
	},
	write: {
		title: "写入时包装记录",
		body: '对于 POST、PUT 和 DELETE，<code>"$mockData"</code> 是单条记录，<code>"$count"</code> 是写入后的记录数。PATCH 与 PUT 共用 template。',
		templateCaption: "POST /customers 的 template",
		responseCaption: "POST /customers，body 为 {body}",
	},
	limits: {
		title: "Template 不会改变的内容",
		body: 'Template 只改变 body。状态码保持不变（200，POST 为 201），错误也不经过 template：404 仍是 <code>"Not found"</code>，其他错误仍是 <code>{errorShape}</code>。',
		size: "一个 template 最多 {depth} 层，最多 {values} 个值和 {faker} 个 Faker 变量。渲染后的 body 超过 {mb} MB 时返回 422 <code>RESPONSE_TOO_LARGE</code>；请用 <code>limit</code> 减少记录数。",
	},
	disable: {
		title: "关闭 endpoint",
		body: '关闭某个 endpoint 的开关后，该路由在扁平和嵌套路由上都返回 404 <code>"Not found"</code>，其他 endpoint 照常运行。PATCH 跟随 PUT 的开关，HEAD 跟随 GET。例如：关闭 DELETE，让试用演示的人无法删除示例数据。',
	},
};
