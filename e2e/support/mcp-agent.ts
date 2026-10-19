import type { Page } from "@playwright/test";
import {
	InMemoryOAuthProvider,
	connectWithOAuth,
} from "../../apps/api/src/modules/mcp/testing/mcp-oauth-client.js";
import { structuredOf } from "../../apps/api/src/modules/mcp/testing/tool-structured-content.js";
import { IDP_ORIGIN, IDP_USER_COOKIE, WEB_ORIGIN } from "./ports.js";

/** The MCP client the SDK connects (typed from the helper, not the SDK). */
type Client = Awaited<ReturnType<typeof connectWithOAuth>>;

/** Redirect URI of the test agent; the browser request is intercepted. */
const AGENT_CALLBACK = "http://127.0.0.1:4639/callback";

/**
 * An agent of `username` connected to Localman MCP: OAuth at the test IdP
 * with the browser playing the user (consent included). `toolsets` opens
 * more than the default ones (`?toolsets=` of the MCP URL).
 */
export async function connectAgent(
	page: Page,
	username: string,
	toolsets: readonly string[] = [],
): Promise<Client> {
	await page
		.context()
		.addCookies([{ name: IDP_USER_COOKIE, value: username, url: IDP_ORIGIN }]);
	const query = toolsets.length > 0 ? `?toolsets=${toolsets.join(",")}` : "";
	const provider = new InMemoryOAuthProvider(AGENT_CALLBACK);
	return connectWithOAuth(
		`${WEB_ORIGIN}/mcp${query}`,
		provider,
		async (url) => {
			// Nothing listens on the agent's loopback callback (an agent would):
			// the redirect is read from the request the browser tries to send.
			const callback = page.waitForRequest((sent) =>
				sent.url().startsWith(AGENT_CALLBACK),
			);
			await page.goto(url.href).catch(() => undefined);
			return new URL((await callback).url());
		},
	);
}

/** Calls a tool and answers its structured result; a tool error throws. */
export async function callTool(
	client: Client,
	name: string,
	args: object,
): Promise<Record<string, unknown>> {
	const result = await client.callTool({ name, arguments: { ...args } });
	if (result.isError) {
		throw new Error(`${name} failed: ${JSON.stringify(result.content)}`);
	}
	return structuredOf(result);
}
