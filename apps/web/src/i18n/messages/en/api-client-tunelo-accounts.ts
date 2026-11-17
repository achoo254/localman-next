/** Tunnels found through the user's Tunelo account and linked machines. */
export const apiClientTuneloAccounts = {
	badge: "Via Tunelo · {device}",
	basicAuth: "This tunnel asks for Basic Auth",
	basicAuthBody:
		"The request's Authorization header was used for the tunnel's Basic Auth, so your app may not receive it.",
	notice: {
		stopped: "The tunnel for {key} stopped",
		stoppedBody: "Run <code>{command}</code> again, then click Send again.",
		tcpOnly: "Only a TCP tunnel serves {key}",
		tcpOnlyBody:
			"The API client sends HTTP only. Open an HTTP tunnel with <code>{command}</code>.",
	},
	choose: {
		title: "Choose a tunnel for {key}",
		body: "Several of your tunnels serve this port. Pick the one that gets the request.",
		basicAuth: "Basic Auth",
		remember: "Your choice is remembered for this address in this browser.",
	},
	links: {
		title: "Linked machines",
		hint: "Machines linked with a code before that way of linking was retired. Only you see their tunnels; remove one you no longer use.",
		unnamed: "Machine without a tunnel yet",
		linkedAt: "Linked {date}",
		revoke: "Revoke the link of {name}",
		revoked: "Revoked on the machine. Remove it.",
	},
} as const;
