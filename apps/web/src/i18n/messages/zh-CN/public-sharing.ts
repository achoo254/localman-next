import type { Messages } from "../../message-types";
import { publicSharingShare } from "./public-sharing-share";
import { publicSharingView } from "./public-sharing-view";

export const publicSharing: Messages["publicSharing"] = {
	errors: {
		forbidden: "只有 workspace 的 Admin 和 Editor 可以公开此 collection。",
		publicLinksDisabled:
			"此 workspace 已关闭公开链接。Admin 可以在 workspace 设置中重新开启。",
		guestsDisabled:
			"此 workspace 已关闭访客链接。Admin 可以在 workspace 设置中重新开启。",
		accessKeysDisabled:
			"此 workspace 已关闭 access key。Admin 可以在 workspace 设置中重新开启。",
		accessKeyLimit:
			"你在此 collection 上的 access key 已达上限。请先撤销一个再创建。",
		runButtonLimit: "此 collection 的 Run 按钮已达上限。请先删除一个再创建。",
		environmentNotInWorkspace:
			"该 environment 不在此 collection 所在的 workspace 中，请选择其他 environment。",
		linkNotFound: "此链接不存在或已关闭。",
		runButtonNotFound: "此 Run 按钮不存在或已被删除。",
		rateLimited: "请求过多，请等待一分钟后重试。",
		collectionLimit:
			"该 workspace 的 collection 数量已达上限。请选择其他 workspace 或删除一个 collection。",
		collectionTooLarge: "此 collection 过大，无法导入。",
		importInProgress: "此导入正在进行中，请稍后再试。",
		workspaceUnavailable:
			"你无法向该 workspace 添加 collection，请选择其他 workspace。",
		invalid: "请检查你输入的内容后重试。",
		notFound: "该项已不存在。",
		fallback: "出了点问题，请重试。",
	},
	warning: {
		none: "未发现看起来像 secret 的值。",
		found: {
			other: "{count} 个值看起来像 secret",
		},
		foundText:
			"请检查以下位置。除非把它们移到 secret 变量中，否则这些值会被公开。",
		plainNote:
			"secret 变量和 Authorization 标签页中的凭据会被隐藏。普通变量会按原样公开，body、script 和 URL 也是如此。",
		root: "Collection",
		list: "含有疑似 secret 值的位置",
		places: {
			collectionVariable: "Collection 变量",
			environmentVariable: "Environment 变量",
			script: "Script",
			requestBody: "Request body",
			requestHeader: "Request header",
			exampleHeader: "Example header",
			url: "URL",
		},
	},
	share: publicSharingShare,
	view: publicSharingView,
};
