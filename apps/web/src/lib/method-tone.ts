import type { HttpMethod } from "@localman/shared/api-client";

/**
 * Text colour of an HTTP method (method select, tab chips, history), from
 * step 11 of the Radix scales as the prototype: GET green, POST amber, PUT
 * blue, PATCH violet, DELETE red, HEAD and OPTIONS slate. The `-text`
 * tokens keep ≥ 4.5:1 on the surface in both themes.
 */
export const METHOD_TEXT_CLASS: Readonly<Record<HttpMethod, string>> = {
	GET: "text-viz-green-text",
	POST: "text-viz-amber-text",
	PUT: "text-viz-blue-text",
	PATCH: "text-viz-violet-text",
	DELETE: "text-viz-red-text",
	HEAD: "text-viz-grey-text",
	OPTIONS: "text-viz-grey-text",
};

/** Short form for narrow chips (tab bar, history rows). */
export function methodShortLabel(method: HttpMethod): string {
	return method === "DELETE" ? "DEL" : method === "OPTIONS" ? "OPT" : method;
}
