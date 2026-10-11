import type { Messages } from "../../message-types";

export const collectionsTrash: Messages["collections"]["trash"] = {
	pageTitle: "回收站",
	title: "回收站",
	retention: {
		other: "已删除的 collection 会保留 {count} 天，之后自动永久删除。",
	},
	back: "Workbench",
	search: "按名称搜索",
	searchPlaceholder: "按名称搜索",
	table: "已删除的 collection",
	columns: {
		name: "名称",
		type: "类型",
		workspace: "Workspace",
		deletedBy: "删除者",
		deletedAt: "删除日期",
		daysLeft: "剩余时间",
		actions: "操作",
	},
	items: {
		other: "{count} 个 request",
	},
	typeCollection: "collection",
	deletedWorkspace: "已删除的 workspace",
	removedAccount: "已删除的账号",
	daysLeft: {
		other: "{count} 天",
	},
	restore: "恢复",
	restoreLabel: "恢复 {name}",
	deletePermanently: "永久删除",
	deleteLabel: "永久删除 {name}",
	emptyTitle: "回收站是空的",
	emptyBody: "你删除的 collection 会在这里保留一段时间，方便恢复。",
	noMatch: "没有与“{query}”匹配的内容。",
	loading: "正在加载回收站…",
	loadFailed: "无法加载回收站。",
	restoreModal: {
		title: "恢复“{name}”",
		workspace: "恢复到 workspace",
		noWorkspace: "你无法向自己的任何 workspace 添加 collection。",
		submit: "恢复",
	},
	purge: {
		title: "永久删除",
		question: "永久删除“{name}”？",
		body: "其中的 folder 和 request 也会被删除，无法撤销。",
		confirm: "永久删除",
	},
	toast: {
		restored: "已将 {name} 恢复到 {workspace}。",
		purged: "已永久删除 {name}。",
	},
};
