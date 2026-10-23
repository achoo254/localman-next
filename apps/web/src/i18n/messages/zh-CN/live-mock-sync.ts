import type { Messages } from "../../message-types";

export const liveMockSync: Messages["liveMockSync"] = {
	badge: {
		label: "与 mock 同步",
		title: "与 {name} 的 Live Mock Sync",
		project: "Live Mock Sync",
	},
	settings: {
		title: "Live Mock Sync · {name}",
		toggle: "从 mock 同步",
		toggleHint:
			"单向，从 mock 到 collection。关闭后 collection 变为普通 collection，内容保持不变。",
		project: "Mock project",
		projectHidden: "Mock project 已被删除，或你无法打开。",
		environment: "Environment",
		environmentHint:
			"Live Mock Sync 管理其中的 baseUrl 和每个 resource 的 id 变量。",
		noEnvironment: "不附带 environment",
		lastSynced: "上次同步于 {time}",
		behaviour:
			"你自己修改的部分（header、body、script）会保留。mock 改到同一处时由你选择。mock 不再提供的 request 会移到 _removed folder。",
		needEditor:
			"只有同时是 mock project 和 collection 的 Editor 才能开启或关闭同步。",
		urlChanged:
			"Mock project 的 secret 已更改。Live Mock Sync 不会把新的 mock URL 写入共享的 environment；如果这里的所有人都可以使用它，请自行更新 baseUrl。",
		save: "保存",
		stopped: "已关闭同步。{name} 现在是普通 collection，内容保持不变。",
	},
	banner: {
		title: "Mock 修改了你编辑过的字段",
		count: { other: "{count} 个冲突等待你选择。" },
		resolve: "查看并选择",
	},
	conflicts: {
		title: "来自 {name} 的修改",
		intro: "在 mock 修改了你编辑过的地方，选择保留哪一方。",
		sides: "采用 mock 会使用 mock 的值；保留我的会保留你的值。",
		keepMock: "采用 mock",
		keepMine: "保留我的",
		allMock: "全部采用 mock",
		allMine: "全部保留我的",
		submit: "应用",
		done: "已应用来自 {name} 的修改",
		nothing: "没有待处理的内容：collection 已与 mock 一致。",
		loading: "正在与 mock 比较…",
	},
	project: {
		create: "创建同步 collection",
		open: "打开同步 collection",
		created: "已创建 {name}，与此 mock 同步",
		noWorkspace: "请先在 API client 中选择一个 workspace。",
	},
	names: {
		removedFolder: "mock 不再提供的 request。用完后可删除。",
		removedItem: "已从 mock 中移除。",
		environment: "{name} (mock)",
	},
};
