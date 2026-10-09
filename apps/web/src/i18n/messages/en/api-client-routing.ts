/** Router of the API client: route badges, fallbacks, consent, settings. */
export const apiClientRouting = {
	rail: { routing: "Routing" },
	badge: {
		direct: "Direct",
		local: "Direct (localhost)",
		proxy: "Via proxy",
		proxyCors: "Via proxy · CORS blocked",
		tunelo: "Via Tunelo",
	},
	via: { proxy: "the proxy", tunelo: "your Tunelo tunnel" },
	why: {
		manual: {
			direct: "You chose Direct for this request (next to Send).",
			proxy: "You chose Proxy for this request (next to Send).",
			tunelo:
				"You chose Proxy for this request; a local address goes through its Tunelo tunnel.",
		},
		direct:
			"Sent straight from the browser to {host}; the target allows CORS. The request did not go through a Localman server.",
		local:
			"Sent straight from the browser to {host} on your network. Credentials stayed on your machine.",
		pinned: "{host} is in “Always through the proxy” (Routing settings).",
		forbidden:
			"The browser can't set {headers} with fetch, so the request went through {via} to keep it.",
		redirects:
			"“Follow redirects” is off and a browser can't show a redirect response, so the request went through {via}.",
		remembered:
			"{host} failed a direct send recently (usually CORS), so the request went straight through {via}. Clear it in Routing settings.",
		cors: "The direct send failed (TypeError, usually missing CORS), so the request was sent again through {via}. {host} goes there directly for 24 hours.",
	},
	note: {
		cors: "Sent through {via}: the browser blocked the direct send",
		dropped: "The browser left out {headers}",
		droppedHint:
			"fetch can't set these headers. Choose Proxy next to Send to keep them.",
	},
	failure: {
		blocked:
			"The browser refused to send to {host} directly: CORS, mixed content, local network permission, or the target is down.",
		timeout: "{host} did not answer within the timeout.",
		redirect:
			"{host} answered with a redirect, which a browser can't show while “Follow redirects” is off.",
		interrupted:
			"{host} answered, then the connection broke while the response was read. The request ran on the target, so it was not sent again on its own.",
		notRetried:
			"The direct send to {host} failed, but this request (POST or PATCH) may already have reached the target, so it was not sent again on its own.",
		tunnel:
			"{key} is on your machine: the proxy can't reach it and no tunnel is set for it.",
		consent:
			"Not sent: the request carries credentials and needs your OK to go through the proxy.",
	},
	direct: {
		title: {
			blocked: "TypeError: Failed to fetch · {host}",
			timeout: "No answer from {host}",
			redirect: "Redirect hidden by the browser",
			interrupted: "Response cut off · {host}",
			notRetried: "Not sent again · {host}",
		},
		sendProxy: "Send through proxy",
		tryTunelo: "Try through Tunelo",
		useAuto: "Use Auto",
	},
	consent: {
		title: "Send through the proxy?",
		body: "{target} can't be reached straight from the browser: {reason}. The request carries {parts}.",
		destination: "The proxy will call {url}",
		reason: {
			pinned: "the host is pinned to the proxy",
			forbidden: "a header the browser can't set",
			redirects: "“Follow redirects” is off",
			remembered: "the host recently failed a direct send",
			cors: "the direct send failed (usually CORS)",
			defaultRoute: "new requests use the Proxy route (Routing settings)",
			tunnel: "a local address is reached through its Tunelo tunnel",
		},
		note: "Credentials pass through the Localman server in transit (not stored, not logged)",
		noteBody:
			"The proxy only forwards the request. Its log keeps the host, the status and the time.",
		remember: "Don't ask again for {host}",
		hint: "Change it in Routing settings. To keep credentials on your machine, enable CORS on the target.",
		confirm: "Send through proxy",
		blockedTitle: "Not sent: needs your OK to go through the proxy",
		blockedBody: "The request carries {parts}. Nothing was sent.",
		reopen: "Send through proxy…",
	},
	quota: { plans: "See plans" },
	settings: {
		title: "Routing",
		defaultRoute: "Route of new requests",
		defaultHint:
			"Auto sends straight from the browser and switches to the proxy when it can't (CORS, a header fetch can't set, redirects off). Local addresses use Tunelo instead. The choice next to Send overrides it per request.",
		pinned: {
			title: "Always through the proxy",
			hint: "Auto sends these hosts through the proxy without trying directly.",
			input: "Host",
			placeholder: "api.example.com",
			add: "Add",
			invalid: "Enter a host name or IP, with an optional port.",
			empty: "No host yet.",
			remove: "Remove {host}",
		},
		secrets: {
			title: "Credentials through the proxy without asking",
			hint: "Hosts where you chose “Don't ask again”.",
			empty: "No host yet.",
			remove: "Ask again for {host}",
		},
		cors: {
			title: "Blocked recently (CORS cache)",
			hint: "Origins that failed a direct send in this browser go through the proxy for 24 hours.",
			empty: "No origin blocked.",
			clear: "Clear cache",
			cleared: "CORS cache cleared.",
			forget: "Forget {origin}",
			until: "until {time}",
		},
	},
} as const;
