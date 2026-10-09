/** TEST ONLY. Paths that collapse to `//evil.com` once a browser resolves them. */
export const DOT_SEGMENT_REDIRECTS = [
	"/.//evil.com",
	"/..//evil.com/x",
	"/a/..//evil.com",
	"/%2e//evil.com",
	"/%2E%2E//evil.com",
	"/a/%2e%2e//evil.com",
	"/./\\evil.com",
];
