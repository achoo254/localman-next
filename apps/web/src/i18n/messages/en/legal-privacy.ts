/**
 * `/privacy`. Format and tags as in `legal.ts`; every claim and its source
 * is listed in `docs/legal-pages-review.md`.
 */
export const legalPrivacy = {
	title: "Privacy Policy",
	intro:
		"Localman (the web app at {appHost}, its mock APIs and its MCP endpoints) helps you build mock APIs and send API requests. This policy says what Localman stores, why, who else receives it, how long it is kept and what you can do about it. “We” means the operator of Localman.",
	collect: {
		title: "What we store",
		body: "- <b>Your account:</b> what your {idpName} account shares when you sign in and while you stay signed in: an account ID, username, display name, profile picture link, email address and whether it is verified, and the Telegram chat you linked there, if any. Also the limits that apply to your account, until when extended limits last, and your interface language. Localman has no password of yours.\n- <b>Sign-in sessions:</b> a session cookie and, on the server, the sign-in tokens of the session, encrypted.\n- <b>What you create:</b> mock projects, resources and their data, rules, webhook inboxes and callbacks; API client collections, requests, examples, environments and variables (secret values encrypted), comments, forks and pull requests; your open request tabs, history and settings.\n- <b>Mock request logs:</b> for requests to your mock APIs and webhook inboxes: time, method, path, query, status, duration, and the headers and bodies of the request and response. Bodies are cut at 64 KB; Authorization, Cookie, Set-Cookie and X-API-Key headers, and the headers you choose to hide, are stored as “[redacted]”.\n- <b>API client history:</b> each request as you wrote it, with variables left as placeholders rather than their values, and the status, time and size of the response; not the response headers or body.\n- <b>Usage counters:</b> mock and proxy requests per month, for usage limits.\n- <b>Notifications</b> sent to you, your notification settings and, if you turn on Web Push, the push address of each browser.\n- <b>Feedback and contact forms:</b> your message and, if you give them, your name and an email address or Telegram username to reply to; your account if you were signed in.\n- <b>Linked Tunelo machines:</b> the link token (encrypted) and the machine name.\n- <b>Technical logs:</b> for every request to the server: a request ID, method, route, status and duration; never headers, cookies, bodies or query strings. Requests sent through the API client proxy add your account ID and the destination host.\n- <b>Rate limits:</b> counters keyed by a hash of your IP address range or account, deleted when their time window ends.\n\nLocalman shows no ads and uses no analytics or tracking tools. The browser keeps your language, theme and some app state (open pages, sort order, tunnel choices) in local storage on your device.",
	},
	purposes: {
		title: "Why we use it",
		body: "- To run the features you use: serving your mock APIs, sending your requests, sharing with the people you invite, notifying you through the channels you chose.\n- To apply usage limits and rate limits and to stop abuse.\n- To keep accounts secure and to find and fix errors.",
	},
	processors: {
		title: "Who else receives data",
		body: "- <b>{idpName} account service</b> (<idp>{idpHost}</idp>): signs you in and sends Localman the account details above. It is a separate service with its own account page.\n- <b>Cloudflare</b>: DNS for Localman, and carries the traffic of the web app and dashboard API. When you send a form without signing in, Cloudflare Turnstile checks that you are not a bot. Requests to the mock API subdomains do not go through Cloudflare. <cloudflare>Cloudflare's privacy policy</cloudflare>.\n- <b>Telegram</b>: only if you turn on Telegram notifications, their text is sent to your linked chat through Telegram's bot API. When anyone sends the feedback form, a short excerpt (up to 300 characters) with the reply address masked is sent to the operator's Telegram chat. <telegram>Telegram's privacy policy</telegram>.\n- <b>Your browser's push service</b> (from the browser maker): only if you turn on Web Push, it delivers the notifications to your device.\n- <b>Tunelo</b> (<tunelo>{tunnelHost}</tunelo>): only if you use Tunelo with Localman, Localman reads your list of tunnels and sends requests for your local apps through your tunnels.\n- <b>Addresses you choose:</b> requests you send with the API client proxy, mock upstreams, callbacks and inbox forwards go to the addresses you set, with the content you set.",
	},
	retention: {
		title: "How long we keep it",
		body: "- <b>Account, projects, collections and settings:</b> until you delete them or your account.\n- <b>Mock request logs:</b> 7 days with standard limits, 30 days while extended limits apply, and at most the newest 20,000 per project.\n- <b>API client history:</b> 90 days, at most 500 entries.\n- <b>Notifications:</b> 90 days.\n- <b>Sessions:</b> end after 30 days without use, and after 90 days at most.\n- <b>Deleted collections:</b> stay in the trash for 30 days.\n- <b>Feedback and contact messages:</b> until the operator deletes them.\n- <b>Projects without activity</b> for 90 days may be deleted by the operator while their owner has standard limits.\n- <b>Backups:</b> the database is backed up every night and the latest 14 backups are kept on the server, so deleted data can remain in a backup for up to 14 days.",
	},
	rights: {
		title: "Your choices",
		body: "- <b>See and export:</b> export collections and environments as files; see your request logs and history in the app.\n- <b>Change and delete:</b> edit or delete your projects, data, collections, environments, history and comments at any time.\n- <b>Notifications:</b> choose the channels per event, or turn them off.\n- <b>Delete your account:</b> in Account, under “Delete account”. <accountDelete>What deletion removes</accountDelete>. Your {idpName} sign-in account is deleted separately, at <idpDelete>its account page</idpDelete>.\n- Other requests about your data: see Contact below.",
	},
	security: {
		title: "Security",
		body: "Connections use HTTPS. The session cookie cannot be read by scripts. Sign-in tokens, secret variable values and Tunelo link tokens are encrypted at rest; invitation tokens, access keys and MCP tokens are stored only as hashes. No system is perfectly secure.",
	},
	changes: {
		title: "Changes",
		body: "When this policy changes, the date at the top changes with it.",
	},
} as const;
