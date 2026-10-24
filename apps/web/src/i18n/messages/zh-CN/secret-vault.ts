import type { Messages } from "../../message-types";

export const secretVault: Messages["secretVault"] = {
	title: "Secret 保险库",
	header: {
		label: "Secret 保险库：{state}",
		state: {
			none: "未创建",
			locked: "已锁定",
			unlocked: "已解锁",
		},
	},
	menu: {
		note: "已在此设备上解锁",
		lock: "锁定",
		reset: "重置保险库…",
	},
	passphrase: {
		label: "口令",
		show: "显示口令",
		hide: "隐藏口令",
	},
	strength: {
		empty: "至少 {min} 个字符",
		short: "太短：至少需要 {min} 个字符",
		weak: "弱：请再长一些，或混合字母、数字和空格",
		fair: "中：再加几个词会更强",
		strong: "强",
	},
	create: {
		title: "创建 secret 保险库",
		titleAfterReset: "创建新的保险库",
		afterReset:
			"旧的保险库已删除。为新保险库设置口令，然后重新输入 secret 变量的本地值。",
		intro:
			"secret 变量（environment、globals 和 collection 变量）的本地值会在此浏览器中用你的口令生成的密钥加密。服务器只保存加密后的副本。团队的共享值不变。",
		tip: "提示：用一句只有你记得的 4 到 5 个词组成的短语，并保存在密码管理器中。",
		confirm: "再次输入口令",
		mismatch: "两次输入的口令不一致",
		warningTitle: "忘记口令，本地值就无法找回",
		warningBody:
			"我们不保存你的口令，也无法解密你的数据。忘记口令后，secret 变量的所有本地值都会丢失，只能重置保险库并重新输入。",
		ack: "我已了解：忘记口令后，secret 变量的本地值无法恢复。",
		busy: "正在生成密钥，需要一点时间…",
		submit: "创建保险库",
		created: "已创建保险库，并已在此设备上解锁。",
	},
	unlock: {
		title: "解锁 secret 保险库",
		intro: "输入口令，在此浏览器中解密 secret 变量的本地值。",
		empty: "请输入保险库口令",
		wrong: "口令不正确。请检查 Caps Lock 和输入法后重试。",
		busy: "正在验证口令…",
		forgot: "忘记口令？",
		submit: "解锁",
		unlocked: "已解锁保险库。",
	},
	lock: {
		locked: "已锁定保险库。使用 secret 本地值的 request 会暂停，直到你解锁。",
	},
	reset: {
		title: "重置 secret 保险库",
		question: "删除 secret 变量的所有本地值？",
		body: "口令无法找回。重置会在你的所有设备上删除保险库及其加密的所有本地值，之后你用新口令创建新的保险库。",
		agents: "允许 agent 使用的副本也会删除。团队的共享值不受影响。",
		confirmLabel: "输入 <code>{word}</code> 以确认",
		submit: "删除并重新创建",
		done: {
			other: "已删除旧保险库及 {count} 个本地值。",
		},
	},
};
