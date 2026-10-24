/**
 * Secret variables in the variable tables: values locked in the vault, and
 * letting agents use a secret, for some hosts (ADR-0009).
 */
export const agentUse = {
	title: "Let agents use",
	vault: {
		noneTitle: "No secret vault yet",
		noneBody:
			"Secret variables here use their shared value only. To set your own local value of a secret, create a vault first: values are encrypted right in your browser with your passphrase.",
		create: "Create vault",
		lockedTitle: "Secret vault is locked",
		lockedBody: {
			one: "{count} local value of a secret variable is hidden. Requests that use it stop without sending until you unlock the vault.",
			other:
				"{count} local values of secret variables are hidden. Requests that use them stop without sending until you unlock the vault.",
		},
		lockedEmpty: "Unlock the vault to set local values of secret variables.",
		unlock: "Unlock vault",
		badge: "Locked",
		cell: {
			locked: "Unlock to view",
			lockedLabel:
				"Local value of {name} is locked. Unlock the vault to view it",
			empty: "No local value",
			emptyAction: "Unlock to set",
			emptyLabel: "No local value for {name}. Unlock the vault to set one",
			none: "Set local value…",
			noneAction: "Create a vault first",
			noneLabel: "Set a local value for {name}: create a secret vault first",
		},
		needUnlock: "Unlock the secret vault first",
		needCreate: "Create a secret vault first",
		skipped: {
			one: "{count} locked local value is left out until you unlock the vault.",
			other:
				"{count} locked local values are left out until you unlock the vault.",
		},
		saveLocked:
			"the secret vault is locked. Unlock it to save values of secret variables.",
		saveLockedTitle:
			"Not saved: unlock the secret vault to save values of secret variables.",
		failed: "We couldn't open the secret vault. Try again.",
	},
	control: {
		off: "Let agents use {name}",
		offTitle: "Let agents use: off. Choose the hosts it may be sent to",
		on: "Let agents use {name}: on for {hosts}. Edit hosts",
		onTitle: "Agents may use {name} when sending to {hosts}",
		gatedUnlock:
			"Unlock the secret vault to change Let agents use for your local value.",
		gatedCreate:
			"Create a secret vault to change Let agents use for your local value.",
	},
	menu: {
		enable: "Let agents use…",
		edit: "Edit hosts for agents",
		hosts: { one: "{count} host", other: "{count} hosts" },
		off: "Stop letting agents use",
	},
	dialog: {
		titleEnable: "Let agents use a secret",
		titleEdit: "Edit hosts for agents",
		intro:
			"AI agents connected over MCP can send requests that use <code>{token}</code>, but the server fills this secret in only for requests to the hosts you list. Agents never see the value.",
		hostsLabel: "Allowed hosts (one per line)",
		count: "{count}/{max} hosts.",
		needOne: "Add at least one host.",
		help: "For example <code>api.example.com</code>, or <code>*.example.com</code> for every subdomain. {app} hosts are never allowed.",
		suggested: "Suggested from base URLs:",
		suggestionsLabel: "Host suggestions from base URLs",
		addHost: "Add {host}",
		localTitle: "Your local value no longer stays only in this browser",
		localBody:
			"The server keeps an extra copy of your local value, encrypted with the server's key (no passphrase needed), to fill it into your agents' requests. Turning this off, removing the local value or resetting the vault deletes that copy.",
		sharedTitle: "Only your own agents",
		sharedBody:
			"This lets only your agents use the shared value. Teammates who want their agents to use it turn it on themselves, with their own hosts.",
		factsLabel: "What this allows",
		factOutside:
			"Requests to hosts outside the list: the server does not fill this secret in.",
		factRedirect: "Redirects to another host are not followed.",
		factOnlyYou:
			"Only you can turn this on, off or edit the list, in the browser. Agents cannot do it themselves.",
		submitEnable: "Let agents use",
		submitEdit: "Save hosts",
		turnOff: "Stop letting agents use",
		lineError: "Line {line} ({host}): {reason}",
		tooMany: "At most {max} hosts.",
		problems: {
			scheme: "enter the host only, without https://, a port or a path",
			format: "not a valid host (for example api.example.com or *.example.com)",
			open: "too broad: a wildcard must cover one owner's domain, not *.com, *.co.uk or a shared host such as *.herokuapp.com",
			app: "secrets are never sent to {app} hosts",
			duplicate: "same as line {line}",
		},
		errors: {
			notSecret:
				"Only saved secret variables can be used by agents. Save the variable as a secret, then try again.",
			invalid:
				"The server did not accept these hosts. Check them and try again.",
			failed: "We couldn't save the hosts. Try again.",
			copyFailed:
				"Your local value could not be prepared for agents, so nothing was turned on. Try again.",
			vaultLocked:
				"Unlock the secret vault to let agents use your local value.",
		},
	},
	toast: {
		enabled: {
			one: "Agents can use {name} for requests to {count} host, without seeing it.",
			other:
				"Agents can use {name} for requests to {count} hosts, without seeing it.",
		},
		saved: {
			one: "Saved {count} host for agents using {name}.",
			other: "Saved {count} hosts for agents using {name}.",
		},
		off: "Agents can no longer use {name}.",
		offLocal:
			"Agents can no longer use {name}. The server deleted its copy for agents.",
		offFailed: "We couldn't stop agents using {name}. Try again.",
	},
} as const;
