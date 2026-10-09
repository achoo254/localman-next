/** Conditional rules of an endpoint in the resource form. */
export const resourceRules = {
	toggle: "Rules",
	toggleCount: { one: "Rules · {count}", other: "Rules · {count}" },
	toggleLabel: "Rules for {endpoint}",
	intro:
		"Return a different response when a request matches. Rules run from top to bottom; the first match wins.",
	empty:
		"No rules yet. Without rules, this endpoint returns its response template.",
	add: "Add rule",
	limit: "Up to {max} rules per endpoint.",
	limitReached: "This endpoint has {max} rules, the most it can have.",
	title: "Rule {position}",
	toggleRule: "Rule {position}: {summary}",
	incomplete: "Incomplete rule",
	checkRule: "Check this rule",
	when: "When",
	respond: "Respond with",
	source: "Match on",
	sources: {
		header: "Header",
		query: "Query parameter",
		body: "Body (JSONPath)",
		nth: "Request number",
	},
	summarySources: {
		header: "header",
		query: "query",
		body: "body",
		nth: "request number",
	},
	target: {
		header: "Header name",
		query: "Parameter",
		body: "JSONPath",
	},
	op: "Condition",
	ops: {
		eq: "equals",
		neq: "doesn't equal",
		contains: "contains",
		regex: "matches regex",
		exists: "exists",
		gt: "is greater than",
		lt: "is less than",
	},
	value: "Value",
	fieldOf: "{field} of rule {position}",
	headerHint: "Header names aren't case-sensitive.",
	nthHint:
		"Counts requests to this endpoint, starting at 1. The count restarts when you save the resource.",
	status: "Status",
	headers: "Headers (optional)",
	headersHint:
		"A JSON object of header names and text values, for example <code>{example}</code>.",
	body: "Body template (optional)",
	bodyHint:
		'Same variables as the response template. Leave it empty to return <code>"$mockData"</code>.',
	moveUp: "Move rule {position} up",
	moveDown: "Move rule {position} down",
	remove: "Remove rule {position}",
	moved: "Rule moved to position {position} of {count}.",
	removed: "Removed rule {position}.",
	errors: {
		keyRequiredHeader: "Enter a header name.",
		keyRequiredQuery: "Enter a parameter name.",
		headerName:
			"Header names use letters, numbers and - only, for example <code>x-role</code>.",
		jsonPath:
			"Enter a JSONPath that starts with <code>$</code>, for example <code>$.user.role</code>.",
		valueRequired: "Enter a value.",
		number: "Enter a number to compare with.",
		nth: "Enter a whole number from 1.",
		regex: "This regex isn't valid. Check brackets and escapes.",
		regexUnsafe:
			"This regex could make the mock slow. Don't repeat a group, use backreferences or lookaround, and keep to one <code>+</code> or <code>*</code>.",
		tooLong: "Can be at most {max} characters.",
		status: "Enter a status code from {min} to {max}.",
		headers: "Headers must be a JSON object with text values.",
		headersMax: "A rule can set at most {max} headers.",
		headerReserved:
			"A rule can't set <code>{name}</code>. Use your own <code>x-…</code> headers, or <code>cache-control</code>, <code>etag</code>, <code>retry-after</code> and similar.",
		headerLocation:
			"<code>location</code> only works with a 3xx status, such as 301 or 302.",
		headerContentType:
			"<code>content-type</code> must be a JSON type (<code>application/json</code>, <code>application/…+json</code>) or <code>text/plain</code>.",
		headerValue:
			"The value of <code>{name}</code> must be plain text on one line, up to {max} characters.",
		server: "Not accepted: {message}",
	},
} as const;
