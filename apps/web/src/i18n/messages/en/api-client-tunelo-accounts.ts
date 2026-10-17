/** Tunnels found through the user's Tunelo account and linked machines. */
export const apiClientTuneloAccounts = {
	badge: "Via Tunelo · {device}",
	basicAuth: "This tunnel asks for Basic Auth",
	basicAuthBody:
		"The request's Authorization header was used for the tunnel's Basic Auth, so your app may not receive it.",
	notice: {
		stopped: "The tunnel for {key} stopped",
		stoppedBody: "Run <code>{command}</code> again, then check again.",
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
	connect: {
		title: "Link a machine",
		opening: "Getting a code…",
		body: "On the machine that runs the tunnel, enter this code:",
		command: "Run on that machine",
		waiting: "Waiting for the machine… The code expires in 10 minutes.",
		linked: "Machine linked",
		linkedBody:
			"Its tunnels are now found for your local addresses. You can revoke the link here at any time.",
		expired: "The code expired before the machine used it.",
		restart: "Get a new code",
	},
	links: {
		title: "Linked machines",
		hint: "Tunnels of your Tunelo account are found on their own when you run tunelo login with the same sign-in. Link a machine without an account here; only you see its tunnels.",
		add: "Link a machine",
		empty: "No machine linked.",
		unnamed: "Machine without a tunnel yet",
		linkedAt: "Linked {date}",
		revoke: "Revoke the link of {name}",
		revoked:
			"Revoked on the machine. Remove it, then link the machine again if needed.",
	},
} as const;
