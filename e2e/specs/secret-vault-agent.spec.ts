import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import {
	callTool,
	callToolFailing,
	connectAgent,
} from "../support/mcp-agent.js";
import { environmentWithVaultSecret } from "../support/secret-vault-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

interface Named {
	readonly id: string;
	readonly name: string;
}

function namedItems(value: unknown): Named[] {
	if (typeof value !== "object" || value === null) return [];
	const items = (value as { items?: unknown }).items;
	if (!Array.isArray(items)) return [];
	return items.flatMap((item: unknown): Named[] => {
		if (typeof item !== "object" || item === null) return [];
		const { id, name } = item as Record<string, unknown>;
		return typeof id === "string" && typeof name === "string"
			? [{ id, name }]
			: [];
	});
}

/**
 * An agent uses a secret of the user's vault without reading it: not at
 * all until the user turns on "Let agents use" for it in the browser (an
 * agent can neither do that nor write the value), then only towards the
 * hosts the user listed. Every answer the agent gets leaves the value out.
 * (A send that reaches an upstream and masks its echo is covered by the
 * API tests: the proxy refuses the E2E stack's loopback servers.)
 */
test("an agent uses a vault secret only once the user lets it, only on the allowed hosts, never reading it @smoke", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("vault-agent", suffix);
	const secret = `agent-${suffix}-value`;
	await signIn(page, username);
	await openApiClient(page);
	await environmentWithVaultSecret(page, "token", secret);

	const agent = await connectAgent(page, username, ["client", "sharing"]);
	try {
		const [personal] = namedItems(await callTool(agent, "list_workspaces", {}));
		const workspaceId = personal?.id ?? "";
		const environment = namedItems(
			await callTool(agent, "list_environments", { workspaceId }),
		).find(({ name }) => name === "New environment");
		const environmentId = environment?.id ?? "";
		const sendTo = (url: string) =>
			callToolFailing(agent, "send_request", {
				method: "GET",
				url,
				variables: { workspaceId, environmentId },
			});

		// In the vault and not turned on: withheld, by name.
		const withheld = await sendTo("http://mail.example.com:25/?k={{token}}");
		expect(withheld).toContain("SECRET_WITHHELD");
		expect(withheld).toContain("token");
		expect(withheld).not.toContain(secret);

		// The agent cannot write the value nor turn agent use on.
		const written = await callToolFailing(
			agent,
			"set_environment_local_values",
			{ environmentId, values: [{ key: "token", value: "from-agent" }] },
		);
		expect(written).toContain("SECRET_VAULT_AGENT_WRITE");
		const { tools } = await agent.listTools();
		expect(tools.map(({ name }) => name)).not.toContain("set_agent_secret_use");

		// The user lets agents use it towards one host, in the browser.
		await openApiClient(page);
		await page.getByTestId("sidebar-rail-environments").click();
		await page.getByTestId("sidebar-envs-item-open").first().click();
		const editor = page.getByTestId("environment-editor");
		await editor.getByTestId("var-table-agent").click();
		const dialog = page.getByTestId("modal-var-agent");
		await dialog.getByTestId("modal-var-agent-hosts").fill("mail.example.com");
		await dialog.getByTestId("modal-var-agent-confirm").click();
		await expect(dialog).toBeHidden();
		await expect(editor.getByTestId("var-table-agent-hosts")).toContainText(
			"mail.example.com",
		);

		// Another host is refused before anything is sent.
		const elsewhere = await sendTo("http://other.example.com/?k={{token}}");
		expect(elsewhere).toContain("AGENT_HOST_NOT_ALLOWED");
		expect(elsewhere).not.toContain(secret);

		// The allowed host gets past the secret's gates; the proxy then
		// refuses the mail port, and that answer leaves the value out too.
		const allowed = await sendTo("http://mail.example.com:25/?k={{token}}");
		expect(allowed).toContain("PROXY_TARGET_BLOCKED");
		expect(allowed).not.toContain(secret);
	} finally {
		await agent.close();
	}
});
