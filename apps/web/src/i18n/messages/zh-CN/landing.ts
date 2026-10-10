import type { Messages } from "../../message-types";

export const landing: Messages["landing"] = {
	meta: {
		titleMock: "Localman · 带状态、关联和 Faker 的 mock REST API",
		titleLocalhost: "Localman · 直接在浏览器中测试 localhost API",
		description:
			"几分钟内搭建带状态的 mock REST API：声明 resource，用 Faker.js 生成数据，嵌套关联，立即获得 CRUD endpoint。Free 套餐含 {projects} 个 project。",
		pricingDescription:
			"比较 Localman 套餐：Free 含 {projects} 个 project，Pro 为实际使用中的 project 提供更高额度和更多成员。",
	},
	hero: {
		badgeMock: "面向开发者的 mock REST API",
		badgeLocalhost: "直接在浏览器中访问 localhost",
		titleMock: {
			other:
				"带状态、关联和 Faker 的 <code>mock</code> REST API，Free 套餐含 {count} 个 project",
		},
		titleLocalhost: "直接在浏览器中测试 <code>localhost</code> API",
		subMock:
			"声明 resource，一键生成模拟数据，立即获得完整的 CRUD endpoint。前端不必再等后端。",
		subLocalhost:
			"<b>无需安装应用或扩展，只要一条 Tunelo 命令。</b>运行 <code>tunelo http 3000</code>，Localman 会按端口自动识别 tunnel，并把 request 发到 <code>localhost</code> 或局域网内的机器。还附带带状态的 mock REST API，前端不必等后端。",
		howItWorks: "了解工作原理",
		noteMock:
			"无需信用卡。Free 套餐包含 {projects} 个 project、每个 project {resources} 个 resource，custom response 免费使用。",
		noteLocalhost:
			"无需信用卡。Free 套餐包含 {projects} 个 mock project、每个 project {resources} 个 resource、每月 {proxy} 次 proxy request。",
	},
	preview: {
		viaTunelo: "经由 Tunelo",
		tunnelFound: "已自动识别端口 3000 的 tunnel",
		records: { other: "{count} 条记录" },
	},
	liveSync: {
		title: "修改 mock，collection 自动更新",
		lead: "带状态的 mock 会自动生成一个 collection 和可直接运行的 environment，并保持同步。重命名 resource 后，request 的 path 随之更新；你修改过的 header 或 body 会保留。",
		play: "将 users 重命名为 members",
		updated: { other: "已更新 {count} 个 request" },
		synced: "已同步",
		fields: "Field：",
		collection: { other: "Collection · {count} 个 request" },
		headerKept:
			"你在“List {name}”中添加的 <code>X-Debug</code> header 保持不变。",
	},
	mockMcp: {
		eyebrow: "即时 Mock MCP",
		title: "你的 mock 成为 AI agent 的工具",
		lead: "每个 mock project 都自带一个 MCP endpoint。Agent 可以在 mock 自身的带状态数据上调用 <code>list_users</code> 或 <code>create_posts</code>，你无需自己编写 MCP server。",
		snippetHelp:
			"Streamable HTTP · 与 REST 共用数据。将 <code>a1b2c3d4</code> 替换为你的 project secret；完整命令见 project 的 MCP 标签页。",
		toolsTitle: "由 resource 自动生成的工具",
		toolsBadge: { other: "每个 resource {count} 个工具" },
		toolsHelp:
			"像 <code>posts</code> 这样的嵌套 resource 还会接收 <code>parentId</code>。通过 MCP 创建的记录，<code>GET /users</code> 立即可见。",
	},
	pricing: {
		eyebrow: "价格",
		title: "免费开始，按需升级",
		freePrice: "免费",
		rateNote: "按月不限量的额度仍有每秒速率限制，以防滥用。",
	},
	modeling: {
		title: "简单的数据建模",
		lead: "每个 resource 都是一张 field 表。选择数据类型或 Faker.js 方法，Localman 就会按该结构生成数据。",
		schemaLabel: "users 的 schema",
		tableLabel: "Schema 表格，可横向滚动",
		fieldCount: { other: "{count} 个 field" },
		none: "无",
		previewLabel: "users 的示例数据",
		sampleSource: "示例数据来自 Faker.js",
		reroll: "换一组示例",
	},
	relations: {
		eyebrow: "关联",
		title: "Resource 之间的关联",
		lead: "把 resource 互相嵌套，即可得到 <code>/users/:userId/posts</code> 这样的 endpoint。试着在下方把 <b>comments</b> 嵌套到 <b>posts</b> 中。",
		tree: "Resource 树",
		nested: "已将 {child} 嵌套到 {parent}。",
		movedToRoot: "已将 {child} 移回根级。",
		endpoints: "生成的 endpoint",
		endpointCount: { other: "{count} 个 endpoint" },
		listLabel: "Endpoint 列表，可纵向滚动",
	},
	features: {
		eyebrow: "功能",
		title: "更多功能",
		comingSoon: "即将推出",
		seeExample: "查看示例",
		pagination: {
			title: "分页",
			description: "用 query string 对列表分页。",
		},
		sorting: {
			title: "排序",
			description: "按任意 field 升序或降序排列。",
		},
		filtering: {
			title: "筛选",
			description: "在所有 field 中搜索，或按某个 field 筛选。",
		},
		generator: {
			title: "数据生成",
			description:
				"{methods} 个 Faker.js 方法，每次点击最多生成 {max} 条记录。",
		},
		customResponse: {
			title: "Custom response",
			description:
				'为每个 endpoint 设置专属 template，可使用 <code>"$mockData"</code>、<code>"$count"</code> 变量和 Faker.js。',
		},
		collaboration: {
			title: "协作",
			description: "通过用户名、邮箱或邀请链接邀请队友，共同编辑一个 project。",
		},
		customEndpoints: {
			title: "自定义 endpoint",
			description: "在默认 CRUD 之外自定义路径和方法。",
		},
		webhooks: {
			title: "Webhook",
			description: "数据变化时调用你的 URL。",
		},
	},
	cta: {
		title: "几分钟内搭建你的第一个 mock API",
		text: "创建账号，添加 resource，点击数据生成条，即可得到一个可用的 endpoint。",
	},
};
