import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { createProject, openProject } from "./projects-ui.js";
import { createResource, generateAll, mockUrlOf } from "./resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "./session.js";

/** Tabs of the endpoint card that the hybrid mock adds (`hybridMock` flag). */
export type EndpointTab = "upstream" | "log" | "inbox";

const PANEL_OF: Readonly<Record<EndpointTab, string>> = {
	upstream: "project-detail-upstream",
	log: "project-detail-request-log",
	inbox: "project-detail-inbox",
};

/** Opens one tab of the endpoint card and waits for its panel. */
export async function openEndpointTab(
	page: Page,
	tab: EndpointTab,
): Promise<void> {
	await page.getByTestId(`project-detail-endpoint-tab-${tab}`).click();
	await expect(page.getByTestId(PANEL_OF[tab])).toBeVisible();
}

export interface SeededProject {
	readonly projectName: string;
	/** Mock URL of the `users` collection, `http://{secret}.localhost:4610/users`. */
	readonly usersUrl: string;
}

/**
 * Signs in as a new user, creates a project with a `users` resource and
 * generates its records. Each spec calls this once per test.
 */
export async function seedProjectWithUsers(
	page: Page,
	label: string,
): Promise<SeededProject> {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername(label, suffix));
	const projectName = `Traffic ${label} ${suffix}`;
	await createProject(page, projectName);
	await openProject(page, projectName);
	await createResource(page, "users");
	await generateAll(page);
	return { projectName, usersUrl: await mockUrlOf(page, "users") };
}

/** Mock origin of a project, from the URL of one of its routes. */
export function mockRootOf(url: string): string {
	return url.replace(/\/[^/]*$/, "");
}

/** Mock answers carry `X-Localman-Source`; this reads it from a reply. */
export async function sourceOf(
	request: APIRequestContext,
	url: string,
	headers: Record<string, string> = {},
): Promise<{
	status: number;
	source: string | null;
	headers: Record<string, string>;
	body: unknown;
}> {
	const reply = await request.get(url, { headers });
	const body: unknown = await reply.json().catch(() => null);
	return {
		status: reply.status(),
		source: reply.headers()["x-localman-source"] ?? null,
		headers: reply.headers(),
		body,
	};
}

/**
 * Every answer of the mock runtime (mock, rule, upstream, inbox, errors) is
 * sandboxed: a browser renders no script or frame from it and does not sniff
 * its type.
 */
export function expectSandboxedAnswer(headers: Record<string, string>): void {
	expect(headers["content-security-policy"]).toBe(
		"sandbox; default-src 'none'; frame-ancestors 'none'",
	);
	expect(headers["x-content-type-options"]).toBe("nosniff");
	expect(headers["x-frame-options"]).toBe("DENY");
}
