/** Chaos panel of an endpoint in the resource form. */
export const resourceChaos = {
	toggle: "Chaos",
	toggleLabel: "Chaos for {endpoint}",
	badge: "chaos",
	summaryDelay: "{min}–{max} ms",
	summaryErrors: "{rate}% errors ({status})",
	summaryRateLimit: "{rate}% 429s",
	summaryTimeouts: "{rate}% timeouts",
	intro:
		"Make this endpoint slow or unreliable to test loading states, retries and error handling.",
	order:
		"Rules run first. A request that matches a rule still waits the delay, but only requests no rule matched get errors, 429s or timeouts.",
	delay: "Delay",
	min: "Min",
	max: "Max",
	minLabel: "Min delay in milliseconds",
	maxLabel: "Max delay in milliseconds",
	delayHint: "Each response waits a random time in this range, up to {max} ms.",
	errorRate: "Error rate",
	errorRateLabel: "Error rate in percent",
	errorRateHint: "Share of requests that fail with the error status.",
	errorStatus: "Error status",
	rateLimitRate: "429 rate",
	rateLimitRateLabel: "429 rate in percent",
	rateLimitHint:
		"Share of requests answered 429 Too Many Requests, with a <code>Retry-After</code> header.",
	timeoutRate: "Timeout rate",
	timeoutRateLabel: "Timeout rate in percent",
	timeoutHint:
		"Share of requests held open until the max delay (10 s when it's 0, at most 30 s), then answered 504.",
	off: "Turn off chaos",
	endpointOff: "Turn this endpoint on to use rules and chaos.",
	errors: {
		delayRange: "Enter whole milliseconds from 0 to {max}.",
		delayOrder: "Min can't be more than max.",
		rate: "Enter a percentage from 0 to 100.",
		rateSum:
			"Error rate, 429 rate and timeout rate together can't be over 100%.",
	},
} as const;
