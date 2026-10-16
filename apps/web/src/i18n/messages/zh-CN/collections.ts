import type { Messages } from "../../message-types";
import { collectionsChangelog } from "./collections-changelog";
import { collectionsComments } from "./collections-comments";
import { collectionsExamples } from "./collections-examples";
import { collectionsMeta } from "./collections-meta";
import { collectionsTabs } from "./collections-tabs";
import { collectionsTrash } from "./collections-trash";

export const collections: Messages["collections"] = {
	rail: {
		collections: "Collections",
		trash: "回收站",
	},
	statusBar: {
		globals: "打开 Globals",
		trash: "打开回收站",
	},
	sidebar: {
		title: "Collections",
		new: "新建",
		import: "导入",
		readOnly: "Viewer 无法向此 workspace 添加 collection。",
		search: "搜索 collections",
		searchPlaceholder: "搜索 collection、request…",
		sort: "collections 排序：{label}",
		sortHeading: "collections 排序",
		favoritesFirst: "收藏的 collection 始终排在最前。",
		loading: "正在加载 collections…",
		loadFailed: "无法加载 collection 列表。",
		noMatch: "没有与“{query}”匹配的内容。",
		itemsLoading: "正在加载内容…",
		itemsFailed: "无法加载其中的内容。",
		searching: "正在搜索…",
		searchFailed: "无法搜索 collections。",
		resultsLabel: "搜索结果",
		results: {
			other: "{count} 个结果",
		},
		truncated: "仅显示前 {max} 个结果，请输入更多内容以缩小范围。",
		openFailed: "无法打开 {name}。",
	},
	sorts: {
		nameAsc: "名称 A–Z",
		nameDesc: "名称 Z–A",
		updated: "最近更新",
	},
	empty: {
		title: "还没有 collection",
		body: "把 request 放进 collection，即可保存、与团队共享并导出。",
		new: "新建 collection",
		import: "导入",
	},
	newMenu: {
		blank: "空白 collection",
		template: "REST CRUD 模板",
		fromMock: "从 mock project…",
	},
	defaults: {
		collection: "新 collection",
		folder: "新 folder",
		request: "新 request",
		example: "新 example",
		importedCollection: "导入的 collection",
		importedFolder: "Folder",
		importedRequest: "Request",
	},
	row: {
		star: "收藏 {name}",
		unstar: "取消收藏 {name}",
		more: "{name} 的更多操作",
		rename: "{name} 的新名称",
	},
	dnd: {
		instructions:
			"按 Space 拿起一项，用方向键把它移到另一行上，再按 Space 放下，或按 Escape 取消。",
		picked: "已拿起 {name}。",
		over: "位于 {target} 上方。",
		dropped: "已放下 {name}。",
		cancelled: "已取消移动 {name}。",
	},
	menu: {
		addRequest: "添加 request",
		addFolder: "添加 folder",
		addExample: "添加 example",
		rename: "重命名",
		duplicate: "复制",
		share: "共享",
		copyLink: "复制链接",
		move: "移动",
		export: "导出",
		delete: "删除",
	},
	toast: {
		created: "已创建 {name}。",
		favorited: "{name} 现在排在最前。",
		duplicated: "已复制为 {name}。",
		linkCopied: "已复制链接。只有有权限的人才能打开。",
		linkFailed: "无法复制链接，请在“共享”中复制。",
		exported: "已下载 {file}。",
		exportFailed: "无法导出 {name}。",
		moved: "已将 {name} 移到 {workspace}。",
		trashed: "已将 {name} 移到回收站。",
		nodeDeleted: "已删除 {name}。",
		saved: "已将 {name} 保存到 {workspace}。",
	},
	deleteCollection: {
		title: "删除 collection",
		body: {
			other: "“{name}”及其 {count} 个 request 将移到回收站。",
		},
		bodyEmpty: "“{name}”将移到回收站。",
		kept: {
			other: "它会保留 {count} 天，在此期间有权限的人可以恢复。",
		},
		typeLabel: "输入 <code>{word}</code> 以确认",
		submit: "删除 collection",
	},
	deleteNode: {
		folderTitle: "删除 folder",
		requestTitle: "删除 request",
		question: "删除“{name}”？",
		folderBody: {
			other: "该 folder 及其中的 {count} 个 request 将被永久删除，无法撤销。",
		},
		requestBody: "该 request 将被永久删除，无法撤销。",
		exampleTitle: "删除 example",
		exampleBody: "该 example 将被永久删除，无法撤销。",
		confirm: "删除",
	},
	move: {
		title: "移动“{name}”",
		intro:
			"目标 workspace 的成员按其在那里的角色获得访问权限。单独共享的人保留原有权限。",
		legend: "目标 workspace",
		current: "当前 workspace",
		teamToPersonal: "团队的 collection 无法移到个人 workspace。",
		noAccess: "你无法向这里添加 collection。",
		personal: "只有你能看到。",
		team: "成员按角色查看。",
		submit: "移动",
	},
	import: {
		modeLegend: "导入为",
		tabs: "打开为标签页",
		collection: "保存为 collection",
		collectionHint: "连同 folder、auth、脚本和变量保存到 {workspace}。",
		submit: "保存 collection",
		environmentUnavailable:
			"此 workspace 还不支持 Environments，因此无法导入此文件。",
		environmentViewer:
			"Viewer 无法向此 workspace 添加 environment。请让 Admin 或 Editor 导入此文件。",
	},
	fromMock: {
		title: "从 mock project 创建 collection",
		intro:
			"每个 resource 成为一个 folder，包含 list、get、create、update 和 delete request。记录 id 会变成 <code>{example}</code> 这样的变量。",
		submit: "创建 collection",
	},
	errors: {
		forbidden: "你的角色不允许此操作，请联系 Admin 或 Editor。",
		notFound: "该项已不存在，或你已失去访问权限。",
		teamToPersonal: "团队的 collection 无法移到个人 workspace。",
		workspaceMissing: "其所在的 workspace 已被删除，请从回收站恢复。",
		sameWorkspace: "它已经在该 workspace 中。",
		collectionLimit: "此 workspace 的 collection 已达上限，请先删除一个。",
		nodesLimit: "此 collection 的 folder 和 request 已达上限，请先删除一些。",
		tooDeep: "folder 不能再嵌套更深了。",
		moveCycle: "folder 不能移到它自身里面。",
		moveFailed: "无法移到那里，请刷新后重试。",
		tooLarge: "内容太大，无法保存。",
		confirmation: "请输入确认词后再删除。",
		invalid: "部分内容无效，无法保存。",
		rateLimited: "同时修改太多，请稍等片刻。",
		fallback: "操作未完成，请重试。",
	},
	trash: collectionsTrash,
	...collectionsTabs,
	...collectionsExamples,
	...collectionsMeta,
	...collectionsChangelog,
	...collectionsComments,
};
