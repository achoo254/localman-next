import { trialEn } from "./trial-en.js";

/** Values of an invitation; `inviter` is `null` when the owner has no name. */
export interface InvitationText {
	readonly inviter: string | null;
	readonly project: string;
	readonly days: number;
}

/** Values of a workspace invitation; `role` is already a role name. */
export interface WorkspaceInvitationText {
	readonly inviter: string | null;
	readonly workspace: string;
	readonly role: string;
	readonly days: number;
}

/** An element (collection, environment) and a role, names already translated. */
export interface ElementAccessText {
	readonly element: string;
	/** "collection" or "environment" in the language. */
	readonly kind: string;
	readonly role: string;
}

/** Quota warning values, already formatted for the language. */
export interface QuotaText {
	readonly threshold: number;
	readonly used: string;
	readonly limit: string;
	readonly month: string;
}

/** Owner alert about a contact form message; values already safe to send. */
export interface ContactAlertText {
	/** Label from `contactCategories`. */
	readonly category: string;
	readonly excerpt: string;
	/** Masked reply address (`email la***@gm***.com`), `null` when none. */
	readonly contact: string | null;
	readonly signedIn: boolean;
	readonly source: string;
}

/** Owner alert about the Pro interest form; email already masked. */
export interface ProInterestAlertText {
	/** Line from `proInterestHeadlines`. */
	readonly headline: string;
	readonly email: string;
	readonly needs: string;
	readonly teamSize: string;
	readonly source: string;
}

const monthName = new Intl.DateTimeFormat("en", {
	year: "numeric",
	month: "long",
	timeZone: "UTC",
});

/**
 * English server texts: the source of every key and of `ServerMessages`,
 * the shape the other languages must fill (a missing or extra key fails
 * typecheck). Technical terms (mock, project, URL, API) stay in English
 * in every language.
 */
export const en = {
	/** `month` is 1-12; e.g. "October 2026". */
	formatMonth: (year: number, month: number): string =>
		monthName.format(new Date(Date.UTC(year, month - 1, 1))),
	/** Labels of the notification settings page, per event type. */
	eventLabels: {
		"project.invitation": "Project collaboration invitations",
		"project.mockUrlChanged": "A shared project's mock URL changed",
		"usage.quota": "Monthly mock request quota warnings",
		"trial.ending": "Extended limits ending soon",
		"trial.ended": "Extended limits ended",
		"trial.extension.requested": "Pro trial extension requests (owners)",
		"trial.extension.approved": "Extended limits renewed",
		"trial.extension.declined": "Extended limits not renewed",
		"workspace.invitation": "Workspace invitations",
		"element.shared": "Collections and environments shared with you",
		"access.requested":
			"Requests for access to your collections and environments",
		"access.resolved": "Answers to your access requests",
	},
	roleNames: { admin: "Admin", editor: "Editor", viewer: "Viewer" },
	elementNames: { collection: "collection", environment: "environment" },
	workspaceInvitation: {
		title: "Workspace invitation",
		body: (p: WorkspaceInvitationText): string =>
			`${p.inviter ?? "A workspace Admin"} invited you to the workspace "${p.workspace}" as ${p.role}. The invitation expires in ${p.days} ${p.days === 1 ? "day" : "days"}.`,
	},
	elementShared: {
		title: "Shared with you",
		body: (p: ElementAccessText & { readonly sharer: string | null }): string =>
			`${p.sharer ?? "Someone"} shared the ${p.kind} "${p.element}" with you as ${p.role}.`,
	},
	accessRequested: {
		title: "Access request",
		body: (p: ElementAccessText & { readonly requester: string }): string =>
			`${p.requester} asks for ${p.role} access to the ${p.kind} "${p.element}".`,
	},
	accessResolved: {
		approvedTitle: "Access request approved",
		approvedBody: (p: ElementAccessText): string =>
			`You now have ${p.role} access to the ${p.kind} "${p.element}".`,
		deniedTitle: "Access request declined",
		deniedBody: (p: ElementAccessText): string =>
			`Your request for ${p.role} access to the ${p.kind} "${p.element}" was declined.`,
	},
	invitation: {
		title: "Project collaboration invitation",
		body: (p: InvitationText): string =>
			`${p.inviter ?? "The project owner"} invited you to collaborate on the project "${p.project}". The invitation expires in ${p.days} ${p.days === 1 ? "day" : "days"}.`,
	},
	mockUrlChanged: {
		title: "Mock URL changed",
		body: (p: { readonly project: string }): string =>
			`The project owner changed the mock URL of the project "${p.project}". The old URL no longer works; use the new URL on the project page.`,
	},
	quota: {
		usedUpTitle: "This month's mock API requests are used up",
		usedUpBody: (p: QuotaText): string =>
			`Your projects have used all ${p.limit} mock API requests of ${p.month}. The mock API returns 429 until the start of next month.`,
		warningTitle: (p: QuotaText): string =>
			`You have used ${p.threshold}% of this month's mock API requests`,
		warningBody: (p: QuotaText): string =>
			`Your projects have used ${p.used}/${p.limit} mock API requests of ${p.month}.`,
	},
	/** Sent from the settings page to check every ready channel. */
	testNotification: {
		title: "Test notification",
		body: "If you can read this, Localman's notifications reach you on this channel.",
	},
	/** Errors of the API client (proxy, tunnel mappings) in the user's language. */
	apiClient: {
		/** 429 `PROXY_BUSY`: the account's concurrent proxied requests. */
		proxyBusyUser: (p: { readonly max: number }): string =>
			`You already have ${p.max} requests running through the proxy; wait for one to finish and try again.`,
		/** 429 `PROXY_BUSY`: the whole server's concurrent proxied requests. */
		proxyBusyServer:
			"The proxy is busy with other requests; try again in a moment.",
		/** `domains`: the allowed Tunelo domains, comma separated. */
		tunnelUrlInvalid: (p: { readonly domains: string }): string =>
			`The tunnel URL must be https://<name>.<domain> without port, path or query, where the domain is one of: ${p.domains}.`,
		tunnelsDisabled: "Tunnel URLs are not enabled on this server.",
	},
	/** Hybrid mock, request log and replay (traffic) errors. */
	traffic: {
		/** 502: no enabled tunnel mapping of the owner for the port. */
		tunnelMissing: (p: { readonly port: number }): string =>
			`No tunnel is mapped to localhost:${p.port} in the project owner's API client settings. Run "tunelo http ${p.port}" and add its URL as the tunnel of localhost:${p.port}.`,
		/** 502: the tunnel did not answer (stopped, refused, timed out). */
		tunnelDown: (p: { readonly port: number }): string =>
			`The tunnel to localhost:${p.port} did not answer. Check that "tunelo http ${p.port}" and the local server are running.`,
		unreachable:
			"The upstream did not answer (connection failed or timed out).",
		blocked:
			"The upstream resolves to a private, loopback or link-local address and is not reached.",
		responseTooLarge: (p: { readonly mb: number }): string =>
			`The upstream response is larger than ${p.mb} MB.`,
		busy: "Too many requests are waiting for this project's upstream; try again in a moment.",
		loop: "The request came back to a Localman mock from its upstream; check the project's upstream setting.",
		baseUrlInvalid:
			"The upstream URL must be https://host[:port][/path] without credentials, query or fragment, and must not be a Localman mock URL.",
		baseUrlBlocked:
			"The upstream URL resolves to a private, loopback or link-local address; expose a local server with a Tunelo tunnel instead.",
		baseUrlDns: "The upstream host name could not be resolved.",
		replayBodyTruncated:
			"This request's body was cut at 64 KB in the log, so it cannot be replayed exactly.",
		replayFailed: "The replayed request got no answer from the mock.",
		streamLimit: (p: { readonly max: number }): string =>
			`You already have ${p.max} live request logs open; close one and try again.`,
		callbackUrlInvalid:
			"The callback URL must be https://… without credentials or fragment, and must not be a Localman mock URL. To reach your machine, use tunnel:<port><path>.",
		callbackUrlBlocked:
			"This address points to a private network, so Localman can't send callbacks to it. Expose a local server with a Tunelo tunnel instead.",
		callbackDns: "The callback host name could not be resolved.",
	},
	/** The Pro trial: reminders, extension requests and decisions. */
	trial: trialEn,
	ownerAlerts: {
		suppressed: (count: number): string =>
			`(and ${count} more not sent because of the alert limit)`,
		contactCategories: {
			feedback: "Feedback",
			bug: "Bug report",
			plan_question: "Plan question",
		},
		contact: (p: ContactAlertText): string =>
			[
				`New feedback / contact: ${p.category}`,
				`Message: ${p.excerpt}`,
				`Contact: ${p.contact ?? "not provided"}`,
				`Sender: ${p.signedIn ? "signed in" : "guest"}`,
				`Source: ${p.source}`,
			].join("\n"),
		proInterestHeadlines: {
			created: "Pro plan interest: new sign-up",
			updated: "Pro plan interest: updated",
			recorded: "Pro plan interest: sent again by someone else (history only)",
		},
		proInterest: (p: ProInterestAlertText): string =>
			[
				p.headline,
				`Email: ${p.email}`,
				`Needs: ${p.needs}`,
				`Team size: ${p.teamSize}`,
				`Source: ${p.source}`,
			].join("\n"),
	},
};

/** Every language's server texts; a missing or extra key fails typecheck. */
export type ServerMessages = typeof en;
