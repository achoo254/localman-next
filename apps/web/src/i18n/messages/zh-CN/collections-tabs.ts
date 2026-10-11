import type { Messages } from "../../message-types";

type Tabs = Pick<
	Messages["collections"],
	"page" | "save" | "breadcrumb" | "inherit" | "send"
>;

export const collectionsTabs: Tabs = {
	page: {
		kind: {
			collection: "Collection",
			folder: "Folder",
		},
		nameLabel: {
			collection: "Collection 名称",
			folder: "Folder 名称",
		},
		loadFailed: "无法加载此 collection。",
		folderGone: "此 folder 已不存在，请关闭它的标签页。",
		share: "共享",
		readOnly: "你只能查看此 collection，如需修改请联系 Editor。",
		tabs: {
			label: "Collection 各部分",
			overview: "概览",
			authorization: "Authorization",
			scripts: "脚本",
			variables: "变量",
		},
		status: {
			saving: "正在保存…",
			saved: "所有更改已保存",
			error: "未保存：{message}",
		},
		overview: {
			description: "描述",
			edit: "编辑",
			save: "保存",
			inputLabel: "Markdown 格式的描述",
			hint: "Markdown：标题、列表、**粗体**、*斜体*、`code` 和链接。",
			empty: "还没有描述。",
			details: "详情",
			createdBy: "创建者",
			you: "你",
			member: "一位 workspace 成员",
			updated: "最近更新",
			workspace: "Workspace",
			requests: "Request 数",
		},
		auth: {
			note: "设为“从上级继承 auth”的 request 会使用此 auth。",
			folderInherit: "此 folder 使用上级 folder 或 collection 的 auth。",
		},
		scripts: {
			order:
				"发送时脚本按此顺序运行：collection，然后由外到内的 folder，最后是 request。",
		},
		variables: {
			caption: "Collection 变量",
			hint: "在此 collection 的 request 中以 <code>{example}</code> 的形式使用。secret 的值会被隐藏，导出时留空。",
			secret: "Secret",
			enable: "使用 {name}",
			keyOf: "第 {n} 行的 key",
			valueOf: "{name} 的值",
			markSecret: "隐藏 {name} 的值",
			remove: "移除 {name}",
			add: "添加变量",
			empty: "还没有变量。",
		},
	},
	save: {
		title: "保存到 collection",
		name: "Request 名称",
		collection: "Collection",
		folder: "Folder",
		top: "最外层",
		submit: "保存",
		saved: "已将 {name} 保存到 {collection}。",
		noCollection: "此 workspace 中没有你可以编辑的 collection，请先创建一个。",
		button: "保存",
		buttonLabel: "保存到 collection",
		goneTitle: "已保留为独立 request",
		gone: "其所在的 collection request 已不存在，此标签页不再与其关联。你的修改仍然保留。",
	},
	breadcrumb: {
		label: "Collection 路径",
	},
	inherit: {
		loading: "正在查找 auth 的来源…",
		fromFolder: "继承自 folder <link>{name}</link>",
		fromCollection: "继承自 collection <link>{name}</link>",
		failed: "无法读取其所在的 collection：{reason}",
		gone: "此 request 已不在其 collection 中，因此没有上级 auth。",
	},
	send: {
		unavailable:
			"未发送：无法读取其所在的 collection（{reason}），发送会缺少它的 auth 和脚本。",
		gone: "request 已不在其中",
	},
};
