import type { Messages } from "../../message-types";

export const docsQuickStart: Messages["docs"]["quickStart"] = {
	lead: "创建一个带真实数据的 mock REST API，供前端或测试调用，无需搭建后端。",
	createProject: {
		title: "1. 创建 project",
		body: "在 Projects 页面点击“创建 project”，填写名称，需要的话再加上 API prefix，例如 <code>/api/v1</code>。每个 project 都有自己的 secret，直接写在 mock URL 里；project 页面的 API endpoint 卡片会显示完整 URL。Free 套餐包含 {projects} 个 project，每个 project {resources} 个 resource。",
	},
	mockUrl: {
		title: "2. Mock API 的 URL",
		caption: "同一 project 的两种 URL 形式",
		headerForm: "形式",
		headerUrl: "URL",
		headerWhen: "适用场景",
		subdomain: "子域名",
		subdomainWhen: "默认。",
		path: "路径",
		pathWhen: "你的网络或工具无法解析 project 专属的子域名。",
		secret:
			"Secret 相当于密码：拿到 URL 的人都能读写 mock 数据。Project 所有者点击“更换 mock URL”即可生成新的 secret；旧 URL 立即返回 404，数据保持不变。路径区分大小写。",
		cors: "Mock 返回 JSON，并通过 CORS 允许任意 origin 调用（不发送 cookie），因此网页无论部署在哪里都能直接调用。每个 response 都带有 <code>X-Localman-Request-Id</code> header，寻求支持时请附上它。",
	},
	addResource: {
		title: "3. 添加 resource 并生成数据",
		body: '点击“添加 resource”，用复数形式命名，例如 <code>customers</code>：这个名称就是路由的第一段。Schema 是每条记录的 field 列表；field 可以是基本类型，也可以是生成姓名、邮箱、日期等数据的 Faker 方法。将鼠标悬停在 resource 的数据生成条上，点击想要的记录数（0 到 {max}）。每条记录都有字符串类型的 <code>id</code>，从 <code>"1"</code> 开始编号。',
	},
	endpoints: {
		title: "4. Resource 的五个 endpoint",
		caption: "customers resource 的 endpoint",
		headerResult: "结果",
		list: "200：记录数组。可通过 query 过滤、排序和分页。",
		get: "200：一条记录。",
		post: "201：新记录，id 为下一个编号。Body 中未提供的 schema field 会像点击生成数据时一样自动生成。",
		put: "200：body 中的 field 会合并到记录中，未发送的 field 保持不变。id 不能修改。",
		delete: "200：被删除的记录。其下嵌套 resource 中的所有子记录也会一并删除。",
		body: "POST、PUT 和 PATCH 的 body 是一个 JSON object，需带上 <code>Content-Type: application/json</code> header；缺少该 header 时 body 会被视为空。每个 endpoint 都可以关闭，或调整 response body 的结构，详见 <link>Custom response</link>。",
	},
	nested: {
		title: "5. 嵌套路由",
		intro:
			"在 resource 树上，先点击 <code>orders</code> 左侧的圆点，再点击 <code>customers</code> 右侧的圆点即可嵌套，此后每个 order 都属于一个 customer。<code>orders</code> 的记录会多出 <code>customerId</code> field（父级名称的单数形式加 <code>Id</code>），mock 同时提供嵌套路由和扁平路由：",
		caption: "orders 的路由",
		parentCheck:
			"嵌套路由会检查路径上的每条父记录：customer 3 不存在，或 order 12 属于其他 customer 时，返回 404。嵌套路由上的 POST 从路径中获取 <code>customerId</code>；扁平路由上的 POST 需要 <code>customerId</code> 指向真实存在的 customer，否则返回 400。",
		depth:
			"树最多嵌套 {depth} 层，例如 <code>/customers/3/orders/12/items</code>。只有当树中没有其他同名 resource 时，扁平路由 <code>/orders</code> 才指向该嵌套 resource；如果有同名的根 resource，扁平路由归属于该根 resource。",
	},
	query: {
		title: "6. 过滤、排序、分页",
		intro:
			"列表路由（扁平和嵌套）接受下列参数，可任意组合。处理顺序为：先过滤，再排序，最后分页。完整示例见<link>代码示例</link>。",
		rejected:
			"以 <code>$</code> 开头、包含 <code>.</code> 或方括号的参数名，以及重复发送的参数，都会被拒绝并返回 400 <code>INVALID_QUERY</code>，因此不支持 <code>?price[$gt]=10</code> 这类运算符语法。",
	},
	status: {
		title: "7. 状态码与错误",
		body: '错误的 body 形如 <code>{errorBody}</code>。只有格式正确的 secret 返回 404 时，body 才是 JSON 字符串 <code>"Not found"</code>；格式错误的 secret 会收到带 <code>NOT_FOUND</code> 的通用错误格式。请根据 <code>code</code> 处理错误，因为 <code>message</code> 的措辞可能会变。',
	},
};
