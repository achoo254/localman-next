import type { Messages } from "../../message-types";

export const resourceChaos: Messages["resourceChaos"] = {
	toggle: "Chaos",
	toggleLabel: "{endpoint} 的 Chaos",
	badge: "chaos",
	summaryDelay: "{min}–{max} ms",
	summaryErrors: "{rate}% 错误（{status}）",
	summaryRateLimit: "{rate}% 返回 429",
	summaryTimeouts: "{rate}% 超时",
	intro: "让这个 endpoint 变慢或不稳定，用来测试加载状态、重试和错误处理。",
	order:
		"规则先执行。匹配规则的 request 仍会等待延迟，但只有未匹配任何规则的 request 才会收到错误、429 或超时。",
	delay: "延迟",
	min: "最小",
	max: "最大",
	minLabel: "最小延迟（毫秒）",
	maxLabel: "最大延迟（毫秒）",
	delayHint: "每个 response 会在此范围内随机等待，最长 {max} ms。",
	errorRate: "错误率",
	errorRateLabel: "错误率（百分比）",
	errorRateHint: "以所选错误状态码失败的 request 比例。",
	errorStatus: "错误状态码",
	rateLimitRate: "429 比例",
	rateLimitRateLabel: "429 比例（百分比）",
	rateLimitHint:
		"返回 429 Too Many Requests 并带 <code>Retry-After</code> header 的 request 比例。",
	timeoutRate: "超时率",
	timeoutRateLabel: "超时率（百分比）",
	timeoutHint:
		"连接会保持到最大延迟（为 0 时为 10 秒，最长 30 秒），然后返回 504 的 request 比例。",
	off: "关闭 chaos",
	endpointOff: "开启这个 endpoint 后才能使用规则和 chaos。",
	errors: {
		delayRange: "请输入 0 到 {max} 之间的整数毫秒。",
		delayOrder: "最小值不能大于最大值。",
		rate: "请输入 0 到 100 之间的百分比。",
		rateSum: "错误率、429 比例和超时率之和不能超过 100%。",
	},
};
