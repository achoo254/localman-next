import type { Messages } from "../../message-types";

export const apiClientToolsErrors: Messages["apiClientTools"]["errors"] = {
	code: "代码：{code}",
	unknown: {
		title: "无法发送 request",
		hint: "{message}",
	},
	targetBlocked: {
		title: "Proxy 不会访问此地址",
		hint: "私有、回环和链路本地地址（localhost、10.x、192.168.x、169.254.169.254）已被阻止。请使用公网 URL，或开启 Tunelo tunnel 访问你本机上的服务。",
	},
	portBlocked: {
		title: "Proxy 不会连接邮件端口",
		hint: "端口 25、465 和 587 已被阻止，请使用其他端口。",
	},
	dnsFailed: {
		title: "找不到该主机名",
		hint: "检查 URL 是否拼写错误，以及域名是否存在。",
	},
	timeout: {
		title: "目标未能及时响应",
		hint: "{seconds} 秒内没有收到任何内容。检查服务是否在运行，或在 request 设置中调大超时时间。",
	},
	tooManyRedirects: {
		title: "重定向次数过多",
		hint: "目标重定向超过 {max} 次。检查是否存在重定向循环，或在 request 设置中关闭跟随重定向。",
	},
	connectionFailed: {
		title: "连接目标失败",
		hint: "检查服务是否在该端口接受连接。如果原因提到证书，请检查服务的 TLS 证书。",
	},
	rateLimited: {
		title: "经 proxy 的 request 过多",
		hint: "请稍等片刻再试。",
	},
	quotaExceeded: {
		title: "本月 proxy request 已用完",
		hint: "你已用完本月所有经 proxy 的 request。请改用直连，或等待下月额度。",
	},
	proxyBusy: {
		title: "同时经 proxy 发送的 request 过多",
		hint: "等之前的 request 完成后再发送。",
	},
	network: {
		title: "无法连接 Localman",
		hint: "检查网络连接后重试。",
	},
	unauthenticated: {
		title: "你已退出登录",
		hint: "重新登录后即可经 proxy 发送。",
	},
};
