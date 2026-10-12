import type { Messages } from "../../message-types";

export const projectDetail: Messages["projectDetail"] = {
	loading: "正在加载 project…",
	loadFailed: "无法加载 project",
	missing: {
		title: "找不到 project",
		body: "该 project 可能已被删除，或你没有访问权限。",
		back: "返回 Projects",
	},
	header: {
		collaborators: "协作者",
		collaboratorsCount: "协作者 · {count}",
	},
	endpoint: {
		secretTip: "Project 的 secret。任何拥有它的人都能调用 API，请勿公开分享。",
		prefixTip: "API prefix。可在“编辑 project”中修改。",
		resourceTip:
			"Resource 名称，例如 users。每个 resource 都有 GET、POST、PUT、DELETE。",
		generateAll: "全部生成",
		resetAll: "全部重置",
	},
	addResource: "添加 resource",
	resources: {
		loading: "正在加载 resource…",
		loadFailed: "无法加载 resource",
		empty: "还没有 resource。Resource 是一张拥有独立 CRUD endpoint 的数据表。",
		count: { other: "{count} 个 resource" },
	},
	planLimit: "此 project 已达到其所有者的 resource 上限。",
	toast: {
		created: "已创建 resource <code>{name}</code>。",
		imported: {
			other: "已导入 <code>{name}</code>，共 <b>{count}</b> 条记录。",
		},
		importedEmpty: "已导入 <code>{name}</code>。",
		importedRelated: {
			other: "已导入 <code>{name}</code> 及 {count} 个相关 resource。",
		},
		createdHint: "点击灰色条即可生成数据。",
		updated: "已更新 resource <code>{name}</code>。",
		deleted: "已删除 resource <code>{name}</code>。",
		dataUpdated: "已更新数据",
		recordsFor: {
			other: "<code>{name}</code> 现有 <b>{count}</b> 条记录。",
		},
		generated: "已生成数据",
		reset: "已重置数据",
		noRecords: "<code>{name}</code> 已没有任何记录。",
		generatedAll: { other: "<b>{count}</b> 个 resource 已有新数据。" },
		nested: "已将 <code>{name}</code> 嵌套到 <code>{target}</code>。",
		movedToRoot: "已将 <code>{name}</code> 移到根级。",
		oldDataReset: "旧数据已重置。",
	},
	generate: {
		title: "生成数据",
		question: { other: "为“{name}”生成 {count} 条记录？" },
		clearTitle: "删除数据",
		clearQuestion: "删除“{name}”的所有记录？",
	},
	generateAll: {
		empty: "此 project 还没有 resource。",
		question: "替换现有数据？",
		lead: "以下 resource 已有数据，将重新生成：",
		summary: "{resources}，{records}",
		details: "查看每个 resource",
	},
	resetAll: {
		nothing: "还没有可重置的数据。",
		question: "删除所有记录？",
		lead: "所有 resource 都将恢复为 0 条记录，schema 和 endpoint 保持不变：",
		confirm: "重置数据",
	},
	move: {
		title: "移动 resource",
		nestQuestion: "将“{name}”嵌套到“{target}”？",
		rootQuestion: "将“{name}”移到根级？",
		lead: "以下数据属于原父 resource，将被重置：",
		confirm: "移动",
	},
};
