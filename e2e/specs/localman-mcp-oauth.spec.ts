import { expect, test } from "@playwright/test";
import {
	InMemoryOAuthProvider,
	connectWithOAuth,
} from "../../apps/api/src/modules/mcp/testing/mcp-oauth-client.js";
import { structuredOf } from "../../apps/api/src/modules/mcp/testing/tool-structured-content.js";
import { IDP_ORIGIN, IDP_USER_COOKIE, WEB_ORIGIN } from "../support/ports.js";
import { projectLink } from "../support/projects-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** Redirect URI of the test agent; the browser request is intercepted. */
const AGENT_CALLBACK = "http://127.0.0.1:4639/callback";
const MCP_URL = `${WEB_ORIGIN}/mcp`;

async function idpEndpoint(name: string): Promise<string> {
	const response = await fetch(
		`${IDP_ORIGIN}/.well-known/openid-configuration`,
	);
	const metadata: unknown = await response.json();
	const value =
		typeof metadata === "object" && metadata !== null
			? Object.entries(metadata).find(([key]) => key === name)?.[1]
			: undefined;
	if (typeof value !== "string") throw new Error(`No ${name} in discovery`);
	return value;
}

function postForm(url: string, form: Record<string, string>) {
	return fetch(url, { method: "POST", body: new URLSearchParams(form) });
}

test("an agent authorizes Localman MCP at the IdP, creates a project the user then sees @smoke", async ({
	page,
	request,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("mcp", suffix);
	const projectName = `Agent ${suffix}`;

	// Discovery: the 401 points at the metadata, which names the IdP.
	const challenge = await request.post("/mcp", { data: {} });
	expect(challenge.status()).toBe(401);
	expect(challenge.headers()["www-authenticate"]).toBe(
		`Bearer resource_metadata="${WEB_ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
	);
	const metadata = await request.get(
		"/.well-known/oauth-protected-resource/mcp",
	);
	expect(await metadata.json()).toMatchObject({
		resource: MCP_URL,
		authorization_servers: [IDP_ORIGIN],
	});

	// Registration, consent and token: the browser plays the user.
	await page
		.context()
		.addCookies([{ name: IDP_USER_COOKIE, value: username, url: IDP_ORIGIN }]);
	const provider = new InMemoryOAuthProvider(AGENT_CALLBACK);
	const client = await connectWithOAuth(MCP_URL, provider, async (url) => {
		expect(url.searchParams.get("resource")).toBe(MCP_URL);
		// Sent by the SDK because the IdP advertises it; ignored by the IdP.
		expect(url.searchParams.get("scope")?.split(" ")).toContain(
			"offline_access",
		);
		// Nothing listens on the agent's loopback callback (an agent would):
		// the redirect is read from the request the browser tries to send.
		const callback = page.waitForRequest((sent) =>
			sent.url().startsWith(AGENT_CALLBACK),
		);
		await page.goto(url.href).catch(() => undefined);
		return new URL((await callback).url());
	});

	try {
		const project = structuredOf(
			await client.callTool({
				name: "create_project",
				arguments: { name: projectName },
			}),
		);
		expect(project.uiUrl).toBe(`${WEB_ORIGIN}/projects/${project.id}`);
	} finally {
		await client.close();
	}

	// The same user signs in to the web app and finds the agent's project.
	await signIn(page, username);
	await expect(projectLink(page, projectName)).toBeVisible();

	// The IdP registered the agent without offline_access (yet refreshes).
	expect(provider.registeredScopes()).toContain("mock:write");
	expect(provider.registeredScopes()).not.toContain("offline_access");

	// Revocation at the IdP ends the grant: the agent cannot renew access.
	const refreshToken = provider.tokens()?.refresh_token ?? "";
	const clientId = provider.clientInformation()?.client_id ?? "";
	expect(refreshToken).not.toBe("");
	const revoked = await postForm(await idpEndpoint("revocation_endpoint"), {
		token: refreshToken,
		token_type_hint: "refresh_token",
		client_id: clientId,
	});
	expect(revoked.status).toBe(200);
	const refresh = await postForm(await idpEndpoint("token_endpoint"), {
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: clientId,
	});
	expect(refresh.status).toBe(400);
	expect(await refresh.json()).toMatchObject({ error: "invalid_grant" });
});
