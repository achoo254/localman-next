import type { Messages } from "../../message-types";

export const agentUse: Messages["agentUse"] = {
	title: "允许 agent 使用",
	vault: {
		noneTitle: "尚未创建密钥库",
		noneBody:
			"这里的 secret 变量只使用共享值。要为 secret 设置你自己的本地值，请先创建密钥库：值会在浏览器中用你的口令加密。",
		create: "创建密钥库",
		lockedTitle: "密钥库已锁定",
		lockedBody: {
			other:
				"{count} 个 secret 变量的本地值已隐藏。使用它们的请求会停止、不发送，直到你解锁密钥库。",
		},
		lockedEmpty: "解锁密钥库后即可为 secret 变量设置本地值。",
		unlock: "解锁密钥库",
		badge: "已锁定",
		cell: {
			locked: "解锁后查看",
			lockedLabel: "{name} 的本地值已锁定。解锁密钥库后查看",
			empty: "没有本地值",
			emptyAction: "解锁后设置",
			emptyLabel: "{name} 没有本地值。解锁密钥库后设置",
			none: "设置本地值…",
			noneAction: "需先创建密钥库",
			noneLabel: "为 {name} 设置本地值：需先创建密钥库",
		},
		renameLocked: "解锁密钥库后才能重命名：它的本地值已锁定。",
		unreadable: "由另一个密钥库加密：输入新值或重置",
		unreadableBadge: "无法打开",
		exists: "此账号已有密钥库，请用它的口令解锁。",
		needUnlock: "请先解锁密钥库",
		needCreate: "请先创建密钥库",
		skipped: {
			other: "已跳过 {count} 个锁定的本地值，解锁密钥库后才会包含。",
		},
		saveLocked: "密钥库已锁定。解锁后才能保存 secret 变量的值。",
		saveLockedTitle: "未保存：解锁密钥库后才能保存 secret 变量的值。",
		failed: "无法打开密钥库，请重试。",
	},
	control: {
		off: "允许 agent 使用 {name}：已关闭。选择主机",
		offTitle: "允许 agent 使用：已关闭。点击选择允许的主机",
		on: "允许 agent 使用 {name}：已对 {hosts} 开启。编辑主机",
		onTitle: "agent 向 {hosts} 发送请求时可以使用 {name}",
		renameBlocked:
			"重命名前请先停止允许 agent 使用：服务器会随旧名称删除主机列表。",
		gatedUnlock: "解锁密钥库后才能更改本地值的“允许 agent 使用”。",
		gatedCreate: "创建密钥库后才能更改本地值的“允许 agent 使用”。",
	},
	menu: {
		enable: "允许 agent 使用…",
		edit: "编辑 agent 的主机",
		hosts: { other: "{count} 个主机" },
		off: "停止允许 agent 使用",
	},
	dialog: {
		titleEnable: "允许 agent 使用 secret",
		titleEdit: "编辑 agent 的主机",
		intro:
			"通过 MCP 连接的 AI agent 可以发送使用 <code>{token}</code> 的请求，但服务器只会把这个 secret 填入发往你所列主机的请求。agent 永远看不到它的值。",
		hostsLabel: "允许的主机（每行一个）",
		count: "{count}/{max} 个主机。",
		needOne: "至少添加 1 个主机。",
		help: "例如 <code>api.example.com</code>，或用 <code>*.example.com</code> 表示所有子域名。不能使用 {app} 的主机。",
		suggested: "根据 base URL 建议：",
		suggestionsLabel: "根据 base URL 建议的主机",
		addHost: "添加 {host}",
		localTitle: "你的本地值将不再只保存在浏览器中",
		localBody:
			"服务器会额外保存一份用服务器密钥加密的本地值（无需口令），用于填入 agent 的请求。关闭此功能、删除本地值或重置密钥库都会删除这份副本。",
		sharedTitle: "仅限你自己的 agent",
		sharedBody:
			"在这里开启只允许你的 agent 使用共享值。团队中其他人想让他们的 agent 使用，需要自己开启并填写自己的主机列表。",
		factsLabel: "这意味着什么",
		factOutside: "发往列表之外主机的请求：服务器不会填入这个 secret。",
		factRedirect: "不会跟随重定向到其他主机。",
		factOnlyYou: "只有你能在浏览器中开启、关闭或编辑列表，agent 无法自行操作。",
		submitEnable: "允许 agent 使用",
		submitEdit: "保存主机",
		turnOff: "停止允许 agent 使用",
		lineError: "第 {line} 行（{host}）：{reason}",
		tooMany: "最多 {max} 个主机。",
		problems: {
			scheme: "只填写主机，不要带 https://、端口或路径",
			format: "不是有效的主机（例如 api.example.com 或 *.example.com）",
			open: "范围过大：通配符必须属于同一所有者的域名，不能是 *.com、*.co.uk 或 *.herokuapp.com 这类共享主机",
			app: "secret 永远不会发送到 {app} 的主机",
			duplicate: "与第 {line} 行重复",
		},
		errors: {
			notSecret:
				"只有已保存的 secret 变量才能给 agent 使用。请先将变量保存为 secret，然后重试。",
			invalid: "服务器不接受这些主机，请检查后重试。",
			failed: "无法保存主机列表，请重试。",
			copyFailed: "无法为 agent 准备你的本地值，因此没有开启任何内容。请重试。",
			vaultLocked: "解锁密钥库后才能让 agent 使用你的本地值。",
		},
	},
	toast: {
		enabled: {
			other:
				"agent 向 {count} 个主机发送请求时可以使用 {name}，但看不到它的值。",
		},
		saved: { other: "已为使用 {name} 的 agent 保存 {count} 个主机。" },
		off: "agent 不再能使用 {name}。",
		offLocal: "agent 不再能使用 {name}。服务器已删除为 agent 保存的副本。",
		offFailed: "无法停止 agent 使用 {name}，请重试。",
	},
};
