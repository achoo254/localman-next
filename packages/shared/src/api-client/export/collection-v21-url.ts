/**
 * URL of an exported v2.1 request: `raw` plus the parts other tools read
 * (protocol, host, port, path, query with disabled rows, hash). Works on
 * the text, so `{{baseUrl}}/users` keeps `{{baseUrl}}` as its host.
 */
import type {
	CollectionV21KeyValue,
	CollectionV21Url,
} from "../import/collection-v21-types.js";

const URL_PARTS =
	/^(?:([a-zA-Z][\w+.-]*):\/\/)?([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/s;

/** Query rows from the URL text, as typed (no decoding). */
function queryFromText(query: string): { key: string; value: string }[] {
	return query
		.split("&")
		.filter(Boolean)
		.map((pair) => {
			const eq = pair.indexOf("=");
			return eq === -1
				? { key: pair, value: "" }
				: { key: pair.slice(0, eq), value: pair.slice(eq + 1) };
		});
}

export function collectionV21Url(
	raw: string,
	/** The params table as v2.1 rows; empty to split the URL's query. */
	params: CollectionV21KeyValue[],
): CollectionV21Url {
	const url: CollectionV21Url = { raw };
	const match = URL_PARTS.exec(raw);
	if (!match) return url;
	const [, protocol, authority = "", path = "", query, hash] = match;
	const port = /^(.*):(\d+)$/.exec(authority);
	const host = port ? port[1] : authority;
	if (protocol) url.protocol = protocol;
	if (host) url.host = host.split(".");
	if (port) url.port = port[2];
	if (path) url.path = path.replace(/^\//, "").split("/");
	if (params.length > 0) url.query = params;
	else if (query) url.query = queryFromText(query);
	if (hash !== undefined) url.hash = hash;
	return url;
}
