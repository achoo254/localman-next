/** Mock callbacks of a resource (Callbacks in "Edit resource") and delivery results. */
export const mockCallbacks = {
	title: "Callbacks",
	subtitle: "Send a request when records change through the mock",
	add: "Add callback",
	max: "Up to {max} callbacks per resource.",
	readonly:
		"You're viewing as a collaborator. Only the project owner can edit callbacks.",
	empty:
		"No callbacks yet. Add one and the mock sends a request to your server on create, update or delete.",
	variables:
		"Variables: <code>{record}</code> the record as JSON, <code>{field}</code> one of its fields, <code>{event}</code> create, update or delete, <code>{resource}</code> the resource name. Sent in the background, retried up to 3 times with backoff; results go to the request log with source <code>callback</code>.",
	saveNote:
		"Callbacks save on their own: Save callbacks keeps them, the resource button does not.",
	loading: "Loading callbacks…",
	loadFailed: "Couldn't load the callbacks. Try again.",
	save: "Save callbacks",
	unsaved: "Unsaved changes",
	saved: "Saved the callbacks.",
	invalid: "A callback isn't valid. Check the marked fields.",
	item: {
		enable: "Enable callback {n}",
		event: "Event of callback {n}",
		on: "on",
		remove: "Remove callback {n}",
		target: "Target",
		targetPlaceholder:
			"https://hooks.example.com/users or tunnel:3000/hooks/users",
		body: "Body template",
		headers: "Headers",
		headerName: "Header name {i}",
		headerValue: "Header value {i}",
		valuePlaceholder: "value",
		hiddenPlaceholder: "Hidden",
		hiddenHint: "Hidden values stay as saved unless you type a new one.",
		addHeader: "Add header",
		removeHeader: "Remove header {name}",
	},
	test: {
		send: "Send test",
		sent: "Sent a test callback to <code>{target}</code>.",
		failed: {
			one: "The test to <code>{target}</code> failed after {count} attempt.",
			other: "The test to <code>{target}</code> failed after {count} attempts.",
		},
		busy: "Other tests are still running. Wait for them, then try again.",
		result: "Test to <code>{target}</code>:",
		response: "Response body",
		truncated: "Cut at 64 KB.",
	},
	last: {
		never: "Not sent yet.",
		sent: "Last sent {time}:",
		attempts: "{ms} ms after {n}/{max} attempts",
	},
	errors: {
		targetEmpty: "Enter an https URL or tunnel:<port><path>.",
		targetHttp:
			"Only https is accepted. To reach your machine, use tunnel:<port><path>.",
		targetFormat:
			"The target is an https URL or tunnel:<port><path>, such as tunnel:3000/hooks/users.",
		targetPort: "Port must be between 1 and 65535.",
		body: "After variables are filled in, the body isn't valid JSON. Note that {record} goes without quotes.",
		bodyTooLarge: "The body template is too large: 64 KB at most.",
		headerName: "Use a header name such as X-Hook-Secret.",
		headerReserved: "{name} is set by Localman. Use another header.",
		headerValue: "A header value fits on one line.",
		headerMax: "Up to {max} headers per callback.",
		headersRefused: "The server refused a header. Check names and values.",
	},
	delivery: {
		attempts: "Delivery attempts, up to {max}",
		attempt: "Attempt {n}/{max}",
		ms: "{ms} ms",
		answered: "Answered {status}",
		errors: {
			noTunnel: "No tunnel mapping for this port",
			connect: "Couldn't connect",
			timeout: "Timed out",
			dns: "The host name didn't resolve",
			blocked: "Blocked: private or reserved address",
			bodyTooLarge: "The body was too large to send",
			invalidTarget: "The target isn't valid",
			queueFull: "Too many deliveries waiting for this account; not sent",
			quotaExceeded: "Monthly mock request quota used up; not sent",
			expired: "Not delivered within an hour; dropped",
		},
	},
} as const;
