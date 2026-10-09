/** MCP tab of the endpoint card (`features/mcp`). */
export const mcp = {
	tabs: {
		label: "Mock endpoints",
		rest: "REST",
		mcp: "MCP",
	},
	endpoint: {
		title: "MCP endpoint",
		urlLabel: "MCP URL",
		urlItem: "URL",
		urlHint:
			"Tools work on the mock's own stateful data: create something over MCP and a REST GET sees it right away. Each tool call counts as 1 request to the mock.",
	},
	config: {
		title: "Agent configuration",
		legend: "Configuration format",
		jsonLabel: "Generic JSON",
		hintOff:
			"No token needed: anyone who knows the MCP URL can call it, like REST.",
		hintOn:
			"The configuration reads the token from the <code>{env}</code> environment variable. Set it before running the command or reopen your editor.",
		hintUnknown:
			"If the project requires a token for MCP, ask the project owner for it, then add the header <code>Authorization: Bearer …</code>.",
		shellHint:
			"Terminal commands are written for bash/zsh (<code>${env}</code>). In PowerShell use <code>$env:{env}</code>, in cmd use <code>%{env}%</code>.",
	},
	token: {
		title: "Require a token for MCP",
		loading: "Loading token settings…",
		loadFailed: "Couldn't load token settings",
		helpOff:
			"By default it works like REST: anyone who knows the MCP URL can call it. Turn this on to require the project's own Bearer token, available on every plan.",
		helpOn:
			"Calls without the header <code>Authorization: Bearer …</code> get a 401. The token is shown only once when it's created; if you lose it, rotate to a new one.",
		hint: "Token lmmcp_…{last4} · created {created}",
		rotate: "Rotate token",
		collaboratorNote:
			"The project owner manages the MCP token. If MCP requires a token, ask the project owner for it.",
		revealTitle: "Save the token now",
		revealLabel: "MCP token",
		revealItem: "token",
		revealHint:
			"The token is shown only this once; Localman doesn't keep a readable copy. Put it in the <code>{env}</code> variable so the configurations above can use it.",
		revealDismiss: "I've saved the token",
	},
	dialogs: {
		enable: {
			title: "Turn on the MCP token",
			question: "Require a token for {project}?",
			body: "Agents calling MCP without a token will get a 401 right away.",
			bodyNew: "The new token is shown only once, after this step.",
			bodyKept: "The token you created before (lmmcp_…{last4}) works again.",
			confirm: "Turn on token",
			toast: "Turned on the MCP token requirement.",
		},
		disable: {
			title: "Turn off the MCP token",
			question: "Stop requiring a token?",
			body: "Anyone who knows the MCP URL can call it, like REST. The current token is kept; turn it back on and the same token works again.",
			confirm: "Turn off token",
			toast: "Turned off the MCP token requirement.",
		},
		rotate: {
			title: "Rotate MCP token",
			question: "Create a new MCP token for {project}?",
			body: "The old token stops working right away. Agents using it get a 401 until you update them with the new token.",
			confirm: "Rotate token",
		},
	},
	tools: {
		title: "Generated tools",
		/** Read after the count badge: "3 tools". */
		countUnit: { one: "tool", other: "tools" },
		empty:
			"No tools yet. Add a resource to get <code>list_</code>, <code>get_</code>, <code>create_</code>, <code>update_</code> and <code>delete_</code> for it.",
		allOff:
			"Every endpoint is turned off, so there are no tools yet. Turn endpoints on in Edit resource.",
		footnote:
			"Endpoints that are turned off don't generate tools. MCP resources: <code>mock://schema</code>, <code>mock://openapi</code>.",
		readOnly: "read-only",
		destructive: "destructive",
		createParams: "body matching the schema",
	},
	try: {
		button: "Try",
		intro:
			"MCP Inspector is an open-source tool from the MCP project that runs on your machine with Node.js. Run the command below in a terminal: Inspector opens a UI in your browser where you can connect and try each tool.",
		commandCaption: "Inspector",
		cliCaption: "Quick check in the terminal",
		quota: "Each tool call counts as 1 request against your mock quota.",
		docs: "MCP Inspector docs",
	},
} as const;
