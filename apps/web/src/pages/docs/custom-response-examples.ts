/**
 * Templates and rendered bodies shown on the Custom responses page. Kept as
 * data so a test can check every `$…` reference against the variables and
 * Faker methods the API accepts when a template is saved.
 */

/** List endpoint: records plus the total count for a pager. */
export const LIST_TEMPLATE = {
	total: "$count",
	items: "$mockData",
	requestId: "$datatype.uuid",
	source: "localman",
} as const;

/**
 * What `GET /customers?page=2&limit=10` returns with `LIST_TEMPLATE`,
 * shortened to 2 of the 10 records.
 */
export const LIST_RESPONSE = {
	total: 42,
	items: [
		{
			id: "11",
			createdAt: "2026-03-14T08:21:05.000Z",
			name: "Lan Anh",
			avatar: "https://…",
		},
		{
			id: "12",
			createdAt: "2025-11-30T16:45:51.000Z",
			name: "Minh Quân",
			avatar: "https://…",
		},
	],
	requestId: "5b1f0c7a-2e94-4d3b-9a61-0c8e7f2d4b13",
	source: "localman",
} as const;

/** Write endpoints (POST, PUT, DELETE): the record inside an envelope. */
export const WRITE_TEMPLATE = {
	ok: true,
	data: "$mockData",
	customers: "$count",
	servedAt: "$date.recent",
} as const;

/** What `POST /customers` returns with `WRITE_TEMPLATE`. */
export const WRITE_RESPONSE = {
	ok: true,
	data: {
		id: "43",
		createdAt: "2026-02-02T10:00:00.000Z",
		name: "Lan Anh",
		avatar: "https://…",
	},
	customers: 43,
	servedAt: "2026-10-09T07:30:12.000Z",
} as const;

/** Faker references named in the variables table. */
export const FAKER_EXAMPLES = [
	"$datatype.uuid",
	"$name.fullName",
	"$date.recent",
] as const;

/** Save-time limits of a template (`TEMPLATE_LIMITS` of the API). */
export const DOCS_TEMPLATE_MAX_DEPTH = 10;
export const DOCS_TEMPLATE_MAX_VALUES = 2_000;
/** Most `$category.method` references one template may hold. */
export const DOCS_TEMPLATE_MAX_FAKER_CALLS = 200;

export function prettyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}
