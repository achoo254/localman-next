/** `/docs/public-sharing`: sharing a collection outside its workspace. */
export const docsPublicSharing = {
	lead: "Share a collection with people outside your workspace: a read-only page, a page for signed-in guests, a key for scripts, or a Run in Localman button for your README.",
	ways: {
		title: "Four ways to share",
		body: "Open <em>Share</em> on a collection. <em>Public</em> turns on a public link (anyone with it reads the collection, no sign-in) and a guest link (signed-in people read it and can ask for edit access). <em>Keys</em> creates read-only access keys. <em>Run</em> creates a button others click to import the collection into their own workspace. Each link, key or button can be turned off at any time.",
	},
	hidden: {
		title: "What is always hidden",
		body: "Values of <code>secret</code> variables; tokens, passwords and API keys typed in the Authorization tab of the collection, folders, requests and saved examples; typed values of headers, query parameters and form fields named like a credential (<code>Authorization</code>, <code>Cookie</code>, <code>Set-Cookie</code>, <code>X-API-Key</code>, <code>access_token</code>, <code>password</code>…); a <code>user:password@</code> in a URL; and the response body of every saved example. A <code>{{variable}}</code> reference stays as written. Local values and unshared environment values never leave your account.",
	},
	kept: {
		title: "What is published as it is",
		body: "Plain variables, request bodies, scripts and URL paths are published as written. Before you share, Localman lists where values that look like secrets sit (never the values), so you can mark them <code>secret</code> or move them to a variable first.",
	},
	who: {
		title: "Who can share, and how to stop",
		body: "Admins and Editors who are members of the workspace can share its collections; a person a collection was shared with alone cannot. Workspace Admins have three switches in the workspace settings: public links (and public Run buttons), guest links and access keys. Turning one off stops what it covers at once. A link also stops when the collection goes to the trash or its creator is no longer an Admin or Editor of the workspace.",
	},
	keys: {
		title: "Access keys",
		body: "A key reads the current collection as Collection v2.1 JSON: <code>GET /api/v1/public/collections/<angle>collection id</angle>?access_key=<angle>key</angle></code>. It is shown once, stops after 60 days without use and can be revoked. Keep it like a password: whoever has it reads the collection.",
	},
	run: {
		title: "Run in Localman button",
		body: "Copy the HTML or Markdown into a README. People who click it sign in, pick one of their workspaces and import a copy of the collection, with the shared, non-secret values of its environment if you attached one. A team button works for members of your workspace only. Scripts run in the browser of whoever imports them, so a public button leaves them out unless the person asks for them.",
	},
};
