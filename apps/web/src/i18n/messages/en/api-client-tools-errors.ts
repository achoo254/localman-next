/**
 * Why a send failed (`apiClientTools.errors`): a title and what to do next
 * per proxy, prepare or network code. Codes without an entry fall back to
 * `unknown` with the API's own message.
 */
export const apiClientToolsErrors = {
	code: "Code: {code}",
	unknown: {
		title: "Couldn't send the request",
		hint: "{message}",
	},
	targetBlocked: {
		title: "The proxy doesn't reach this address",
		hint: "Private, loopback and link-local addresses (localhost, 10.x, 192.168.x, 169.254.169.254) are blocked. Use a public URL, or open a Tunelo tunnel to reach a server on your machine.",
	},
	portBlocked: {
		title: "The proxy doesn't connect to mail ports",
		hint: "Ports 25, 465 and 587 are blocked. Use another port.",
	},
	dnsFailed: {
		title: "The host name couldn't be found",
		hint: "Check the URL for typos, and that the domain exists.",
	},
	timeout: {
		title: "The target didn't answer in time",
		hint: "Nothing came back within {seconds} s. Check that the server is up, or raise the timeout in the request settings.",
	},
	tooManyRedirects: {
		title: "Too many redirects",
		hint: "The target redirected more than {max} times. Check for a redirect loop, or turn off following redirects in the request settings.",
	},
	connectionFailed: {
		title: "The connection to the target failed",
		hint: "Check that the server accepts connections on this port. If the cause names a certificate, check the server's TLS certificate.",
	},
	proxyBusy: {
		title: "Too many requests through the proxy at once",
		hint: "Wait for the requests already running to finish, then send again.",
	},
	rateLimited: {
		title: "Too many requests through the proxy",
		hint: "Wait a moment and try again.",
	},
	quotaExceeded: {
		title: "Monthly proxy requests used up",
		hint: "You used every proxy request of this month. Send directly, or see the plans for more.",
	},
	network: {
		title: "Couldn't reach Localman",
		hint: "Check your connection and try again.",
	},
	unauthenticated: {
		title: "You're signed out",
		hint: "Sign in again to send through the proxy.",
	},
} as const;
