import { type Page, expect, test } from "@playwright/test";
import { send } from "../support/api-client-ui.js";
import { createProject, openProject } from "../support/projects-ui.js";
import { createResource, generateAll } from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

interface Node {
	id: string;
	name: string;
	kind: string;
	parentId: string | null;
	draft?: { url: string };
}

/** Calls the API from the page: same origin, session cookie and CSRF rules. */
async function api<T>(
	page: Page,
	method: string,
	path: string,
	body?: object,
): Promise<T> {
	return page.evaluate(
		async ([m, p, b]) => {
			const res = await fetch(`/api/v1${p}`, {
				method: m,
				headers: b ? { "Content-Type": "application/json" } : {},
				body: b ? JSON.stringify(b) : undefined,
			});
			if (!res.ok) throw new Error(`${m} ${p}: ${res.status}`);
			return res.json();
		},
		[method, path, body] as const,
	) as Promise<T>;
}

/**
 * A collection made from a mock follows it: after `users` is renamed to
 * `members`, its list request points at the new path and the mock answers
 * it with 200.
 */
test("a synced collection follows a renamed resource", async ({ page }) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("live-sync", suffix));
	await createProject(page, `Sync ${suffix}`);
	await openProject(page, `Sync ${suffix}`);
	await createResource(page, "users");
	await generateAll(page);
	const projectId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

	const created = page.waitForResponse(
		(res) =>
			res.request().method() === "POST" &&
			res.url().endsWith("/synced-collections"),
	);
	await page.getByTestId("project-detail-create-sync").click();
	const { collectionId } = (await (await created).json()) as {
		collectionId: string;
	};
	await page.waitForURL("**/api-client");
	await expect(page.getByTestId("collection-meta-sync")).toBeVisible();

	const { items } = await api<{ items: { id: string; name: string }[] }>(
		page,
		"GET",
		`/projects/${projectId}/resources`,
	);
	const users = items.find((item) => item.name === "users");
	await api(page, "PUT", `/projects/${projectId}/resources/${users?.id}`, {
		name: "members",
	});
	// Live Mock Sync applies it about 2 s later.
	await expect
		.poll(
			async () => {
				const detail = await api<{ nodes: Node[] }>(
					page,
					"GET",
					`/collections/${collectionId}`,
				);
				return detail.nodes.find((n) => n.name === "List members")?.draft?.url;
			},
			{ timeout: 15_000 },
		)
		.toBe("{{baseUrl}}/members");

	const detail = await api<{ nodes: Node[] }>(
		page,
		"GET",
		`/collections/${collectionId}`,
	);
	const list = detail.nodes.find((n) => n.name === "List members");
	const folder = detail.nodes.find((n) => n.id === list?.parentId);
	await page.reload();
	await page.getByTestId("tabbar-env-select").click();
	await page
		.getByTestId("env-select-item")
		.filter({ hasText: `Sync ${suffix} (mock)` })
		.click();
	const tree = page.getByTestId("sidebar-tree");
	const row = (id: string | undefined) =>
		tree.locator(`[data-node-id="${id}"]`);
	await row(collectionId).click();
	await row(folder?.id).click();
	await row(list?.id).click();
	await expect(page.getByTestId("request-url")).toHaveValue(
		"{{baseUrl}}/members",
	);
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");
});
