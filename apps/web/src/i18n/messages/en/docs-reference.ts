/** Docs: the query parameter and status code tables. */
export const docsReference = {
	queryParams: {
		caption: "Query parameters of list routes",
		headerParam: "Parameter",
		headerEffect: "Effect",
		headerExample: "Example",
		search:
			"Case-insensitive substring search across every string value at the top level of the record (<code>id</code> included). If you send both, the record must contain both strings.",
		field:
			"Filter by a schema field, by <code>id</code> or by <code>{parentId}</code>. String fields match a case-insensitive substring; numbers and booleans match the exact value; <code>null</code> matches the word <code>null</code>; <code>id</code> and <code>{parentId}</code> match the whole value. With several fields the record must match all of them. Names that aren't fields are ignored.",
		page: "Page number, counting from 1. Only takes effect with <code>limit</code>. Missing or invalid means page 1.",
		limit:
			"Records per page, at most {max} (larger numbers are lowered to {max}). Without it you get every record.",
		sort: 'Sort by one field. Numbers and strings made only of digits compare as numbers, so <code>"2"</code> comes before <code>"10"</code>. Fields that don\'t exist are ignored.',
		order: "<code>desc</code> sorts descending; ascending by default.",
		reserved:
			"A field named like a reserved parameter can't be used as a filter, because the mock reads that name as the parameter: {names}. Rename the field if you need to filter by it.",
	},
	statusCodes: {
		caption: "Status codes and error codes",
		headerCode: "Code",
		headerWhen: "When",
		none: "None",
		ok: "GET, PUT, PATCH and DELETE succeeded.",
		created: "POST created a record; the body is the new record with its id.",
		invalidQuery:
			"A query parameter name starts with <code>$</code>, contains <code>.</code>, <code>[</code> or <code>]</code>, is <code>__proto__</code>, <code>constructor</code> or <code>prototype</code>, or a parameter appears twice.",
		invalidJson:
			"The body is sent with <code>Content-Type: application/json</code> but isn't valid JSON.",
		validation:
			"The body is JSON but not an object, contains a <code>__proto__</code>, <code>constructor</code> or <code>prototype</code> key, or <code>{parentId}</code> doesn't point to an existing parent record when you create a child record on the flat route. A body nested deeper than {depth} levels or holding more than {nodes} values (each object, array and single value counts as one) is also rejected with this code.",
		badRequest:
			"The request was cut off before the body finished, or the server couldn't read the request.",
		unauthenticated:
			"Only on the MCP endpoint (<code>/mcp</code>) when the project requires a token for MCP: the Bearer token is missing or wrong. REST never returns this code.",
		notFoundText:
			"Wrong secret (well-formed), wrong prefix, no such resource or record, the parent record on a nested route doesn't match, the endpoint is off, or the method isn't served on this route (for example POST to <code>/:res/:id</code>). The body is exactly this JSON string.",
		notFoundCode:
			"A malformed secret (only lowercase letters, digits and hyphens, up to 63 characters), so the request points to no project. The body uses the generic error form: <code>{errorBody}</code>.",
		recordLimit: "The resource already has {max} records, the maximum.",
		dataTooLarge:
			"A record exceeds {recordKb} KB, or the resource's total data exceeds {resourceMb} MB.",
		payloadTooLarge: "The request body is larger than {kb} KB.",
		unsupportedMediaType:
			"The body uses a <code>Content-Encoding</code> or charset the server can't read; send uncompressed UTF-8 JSON.",
		responseTooLarge:
			"The response body would exceed {mb} MB; fetch fewer records with <code>limit</code>.",
		rateLimited:
			"Sending too fast (limits per IP and per project). Wait the number of seconds in the <code>Retry-After</code> header, then send again.",
		monthlyQuota: "The project owner has used up the monthly request quota.",
		monthlyQuotaFree:
			"The project owner has used up the monthly request quota (Free plan: {requests} mock requests per month, shared across all their projects).",
		internal:
			"Server-side error. Include <code>X-Localman-Request-Id</code> when you report it.",
	},
} as const;
