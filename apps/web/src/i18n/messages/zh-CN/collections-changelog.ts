import type { Messages } from "../../message-types";

export const collectionsChangelog: Pick<Messages["collections"], "changelog"> =
	{
		changelog: {
			title: "Changelog",
			intro: "同一个人在 5 分钟内的修改会归为一个 session。",
			changes: {
				other: "{count} 处修改",
			},
			viewDiff: "查看 diff",
			closeDiff: "关闭 diff",
			hide: "隐藏 diff",
			hideNote:
				"在 changelog 中隐藏此 diff，不会从 collection 的历史中删除数据。",
			irreversible:
				"此修改过大，无法保存在 changelog 中。你将无法撤销它，也无法恢复更早的修改。",
			show: "显示 diff",
			hidden: "diff 已被 editor 隐藏。",
			unavailable: "此修改过大，未保留 diff。",
			diffFailed: "无法加载此 diff。",
			before: "修改前",
			after: "修改后",
			diffLabel: "{name} 的修改",
			noChange: "内容没有变化。",
			unchangedLines: {
				other: "显示 {count} 行未更改的内容",
			},
			moreLines: {
				other: "再显示 {count} 行",
			},
			affected: {
				title: "此次恢复改动的项目",
				added: "添加了 {name}",
				removed: "删除了 {name}",
				changed: "修改了 {name}",
				unnamed: "某个项目",
			},
			restore: "恢复",
			restoreTitle: "恢复到此修改",
			restoreQuestion: "将 collection 恢复到此修改刚完成时的状态？",
			restoreBody: "这会新增一条修改，不会丢失任何内容。",
			restored: "已恢复 collection。",
			editsDiscarded: "已丢弃打开页面中尚未保存的修改，以免覆盖恢复的内容。",
			unavailableRestore:
				"此修改已无法恢复：之后的某次修改过大未被保留，或它已被清理。",
			loadOlder: "加载更早的",
			loading: "正在加载 changelog…",
			empty: "还没有修改。",
			loadFailed: "无法加载 changelog。",
			removedAccount: "已删除的账号",
			kinds: {
				collection: "collection",
				folder: "folder",
				request: "request",
				example: "example",
			},
			describe: {
				create: "创建了 {kind} {name}",
				update: "修改了 {kind} {name} 的{fields}",
				rename: "重命名了 {kind} {name}",
				move: "移动了 {kind} {name}",
				delete: "删除了 {kind} {name}",
				trash: "将 collection 移到了回收站",
				untrash: "从回收站恢复了 collection",
				restore: "将 collection 恢复到了之前的某次修改",
			},
			fields: {
				name: "名称",
				description: "描述",
				auth: "auth",
				scripts: "脚本",
				draft: "request",
				variables: "变量",
				tags: "tag",
				status: "状态",
				order: "位置",
				parentId: "所在位置",
				request: "request",
				response: "response",
			},
		},
	};
