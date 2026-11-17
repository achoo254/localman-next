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
		hint: "A machine signed in with tunelo login on this account links itself and shows up here. Only you see its tunnels.",
		addSteps:
			"To add a machine, run the install command from the Chat page on it, then sign in with <code>{command}</code>. It shows up here on its own.",
		openChat: "Open Add this machine in Chat",
		empty: "No machine linked.",
		unnamed: "Machine without a tunnel yet",
		linkedAt: "Linked {date}",
		revoke: "Revoke the link of {name}",
		revoked:
			"Revoked on the machine. Remove it, then run tunelo login on the machine again if needed.",
	},
	machines: {
		badge: "Your machine",
		forward: "Send requests to localhost on {name}",
		forwardHint:
			"Requests for localhost go to this machine through its own tunnel. Only you can use it.",
		pick: "Choose a port on {name}",
		pickTitle: "localhost on {name}",
		pickHint:
			"Pick a port listening on the machine, or type one. Requests for that localhost port then go to this machine.",
		loading: "Asking the machine for its ports…",
		noPorts:
			"No port listening, or the machine did not answer. You can still type one.",
		portLabel: "Port",
		use: "Use localhost:{port}",
		chosen:
			"localhost:{port} now goes to {name}. Copied http://localhost:{port}/",
		invalidPort: "Type a port from 1 to 65535.",
	},
} as const;
