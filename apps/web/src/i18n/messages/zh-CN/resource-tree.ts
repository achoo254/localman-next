import type { Messages } from "../../message-types";

export const resourceTree: Messages["resourceTree"] = {
	rail: {
		addToRoot: "移到根级",
	},
	tree: {
		label: "Resource 树",
	},
	zoom: {
		label: "缩放",
		fit: "适应",
		fitHint: "缩放整棵树以适应视图（Shift+1）",
		actualHint: "实际大小（Shift+0）",
	},
	hint: {
		idle: "点击某个 resource 左侧的圆点将其选中，再点击另一个 resource 右侧的圆点，将其嵌套进去。",
		selected:
			"已选中 <b>{name}</b>。点击目标 resource 右侧的圆点进行嵌套，或点击“移到根级”栏。按 Esc 取消。",
	},
	connector: {
		select: "选择要移动的 {name}",
		nest: "将 {moving} 嵌套到 {target}",
		selectedFallback: "所选 resource",
	},
	node: {
		open: "打开 {url}",
		edit: "编辑",
		editLabel: "编辑 {name}",
		data: "数据",
		dataLabel: "{name} 的数据",
		delete: "删除",
		deleteLabel: "删除 {name}",
		moreLabel: "{name} 的更多操作",
	},
	generator: {
		label: "{name} 的记录数",
		value: { other: "{count} 条记录" },
		valueBlocked: { other: "{count} 条记录。{reason}" },
		blockedReason: "请先为 {parent} 生成数据。",
		blockedToast: "为 {name} 生成数据前，需要先为 {parent} 生成数据。",
		parentFallback: "父 resource",
	},
	refuse: {
		selectFirst: "请先选择一个 resource：点击它左侧的圆点。",
		missing: "该 resource 已不存在。请重新加载页面以更新树。",
		self: "无法将 {moving} 嵌套到它自身。",
		alreadyRoot: "{moving} 已在根级。",
		alreadyIn: "{moving} 已在 {target} 中。",
		cycle: "无法将 {moving} 嵌套到 {target}，否则会形成循环。",
		nameTaken: "此位置已有名为 {moving} 的 resource。",
		tooDeep: "Resource 树最多只能嵌套 {max} 层。",
	},
};
