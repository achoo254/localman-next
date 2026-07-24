// Path / content recognition for the response cache: what is an API path, what
// is a static FE asset, and whether a filename carries a content hash. Pure
// string rules, no cache-control logic (that lives in cacheability.ts).

/** Static FE asset extensions worth caching. */
const STATIC_EXTENSIONS = new Set([
	".js",
	".mjs",
	".cjs",
	".css",
	".map",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp",
	".avif",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".otf",
	".eot",
	".wasm",
]);

/**
 * Content-type prefixes for static FE assets. `text/html` is deliberately
 * excluded so the SPA shell always stays fresh and picks up new asset hashes.
 */
const STATIC_CONTENT_TYPES = [
	"text/css",
	"application/javascript",
	"text/javascript",
	"image/",
	"font/",
	"application/font",
	"application/wasm",
];

/** Path prefixes that are always dynamic/API → never cached. */
const API_PATH_PREFIXES = [
	"/api",
	"/graphql",
	"/trpc",
	"/rest",
	"/socket.io",
	"/_next/data",
];

/** Path without query string, lowercased (for extension/prefix matching). */
function pathname(path: string): string {
	const q = path.indexOf("?");
	return (q >= 0 ? path.slice(0, q) : path).toLowerCase();
}

export function isApiPath(path: string): boolean {
	const p = pathname(path);
	return API_PATH_PREFIXES.some(
		(prefix) => p === prefix || p.startsWith(`${prefix}/`),
	);
}

function extensionOf(path: string): string {
	const p = pathname(path);
	const slash = p.lastIndexOf("/");
	const dot = p.lastIndexOf(".");
	return dot > slash ? p.slice(dot) : "";
}

export function isStaticAsset(path: string, contentType: string): boolean {
	if (STATIC_EXTENSIONS.has(extensionOf(path))) return true;
	return STATIC_CONTENT_TYPES.some((prefix) => contentType.startsWith(prefix));
}

/**
 * Heuristic: does the filename carry a content hash (Vite/webpack/Next output)?
 * A hash token is 8+ chars right before the extension, after a `-`/`.`, that
 * looks random — has a digit or mixed case. Case is preserved (not lowercased)
 * so a mixed-case hash like `DqxaS-SZ` is recognized; this excludes plain words
 * like `my-component.js`, keeping a dev's hand-named source file respect-origin.
 */
export function looksContentHashed(path: string): boolean {
	const q = path.indexOf("?");
	const file = (q >= 0 ? path.slice(0, q) : path).split("/").pop() ?? "";
	const match = file.match(/[.-]([a-z0-9_-]{8,})\.[a-z0-9]+(?:\.[a-z0-9]+)?$/i);
	if (!match) return false;
	const token = match[1];
	return /[0-9]/.test(token) || (/[a-z]/.test(token) && /[A-Z]/.test(token));
}

/**
 * Normalize Accept-Encoding to a cache-variant token: keying on it prevents
 * serving a gzip/br body to a client that only accepts identity.
 */
export function normalizeAcceptEncoding(acceptEncoding: string): string {
	const ae = acceptEncoding.toLowerCase();
	if (ae.includes("br")) return "br";
	if (ae.includes("gzip")) return "gzip";
	return "identity";
}
