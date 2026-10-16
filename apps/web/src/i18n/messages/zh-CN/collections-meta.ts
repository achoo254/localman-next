import type { Messages } from "../../message-types";

type Part = Pick<
	Messages["collections"],
	"status" | "tags" | "rightRail" | "info" | "links" | "activity"
>;

export const collectionsMeta: Part = {
	status: {
		add: "添加状态",
		none: "无状态",
		label: "状态：{status}",
		custom: "自定义状态…",
		remove: "移除状态",
		customTitle: "自定义状态",
		name: "名称",
		emoji: "Emoji",
		emojiOther: "或输入一个 emoji",
		save: "保存状态",
		presets: {
			stable: "稳定",
			inDevelopment: "开发中",
			inReview: "审核中",
			deprecated: "已弃用",
		},
		problems: {
			nameLength: "请使用 {min} 到 {max} 个字符。",
			nameStart: "名称需以字母开头。",
			nameCharacters: "名称不能包含不可见字符或控制字符。",
			emoji: "请只选择一个 emoji。",
		},
	},
	tags: {
		title: "Tag {count}/{max}",
		empty: "还没有 tag。",
		input: "新 tag",
		placeholder: "添加 tag",
		add: "添加",
		remove: "移除 tag {tag}",
		hint: "最多 10 个 tag，每个 1 到 {max} 个字符，以字母或数字开头和结尾，保存为小写。",
		tooltip: "Tag：{tags}",
		problems: {
			empty: "请先输入 tag。",
			tooLong: "每个 tag 最多 {max} 个字符。",
			edges: "tag 需以字母或数字开头和结尾。",
			characters: "tag 不能包含不可见字符或控制字符。",
			tooMany: "每个 collection 最多 10 个 tag。",
		},
	},
	rightRail: {
		label: "Collection 详情",
		info: "信息",
		comments: "评论",
		changelog: "Changelog",
		close: "关闭面板",
		backdrop: "关闭详情面板",
	},
	info: {
		title: "信息",
		id: "ID",
		copyId: "复制 ID",
		copied: "已复制 ID。",
		created: "创建时间",
		role: "你的角色",
	},
	links: {
		environment: "相关 environment",
		mockProject: "相关 mock project",
		notLinked: "未关联",
		none: "无",
		sharedHint: "与此 collection 一起共享",
		choose: "更改相关 environment",
		linked: "已将 {name} 关联到此 collection。",
		unlinked: "此 collection 已没有相关 environment。",
	},
	activity: {
		title: "最近动态",
		empty: "还没有动态。",
		loadFailed: "无法加载动态。",
		openChangelog: "打开 changelog",
	},
};
