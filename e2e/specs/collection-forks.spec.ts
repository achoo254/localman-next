import { type Page, expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { signIn, uniqueUsername } from "../support/session.js";

interface Detail {
	nodes: { id: string; name: string; draft?: Record<string, unknown> }[];
}

/** Calls the API from the page: same origin, session cookie and CSRF rules. */
async function api(
	page: Page,
	method: string,
	path: string,
	body?: object,
): Promise<Detail> {
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
	);
}

/**
 * Fork a collection of the personal workspace, rename a request in the
 * fork and merge it back; then change the source and pull it into the
 * fork. Every new account has the Pro period that forks need.
 */
test("fork a collection, merge a change back and pull one in", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("forks"));
	await openApiClient(page);
	await page.getByTestId("sidebar-collections-new").click();
	await page.getByTestId("new-menu-template").click();
	const tree = page.getByTestId("sidebar-tree");
	await tree.getByText("REST CRUD").click();

	const sourceRow = tree
		.locator("[data-node-id]")
		.filter({ hasText: "REST CRUD" });
	const sourceId = await sourceRow.first().getAttribute("data-node-id");
	await page.getByTestId("collection-header-fork").click();
	await page.getByTestId("modal-fork-label").fill("e2e-fork");
	const created = page.waitForResponse(
		(res) => res.request().method() === "POST" && res.url().endsWith("/forks"),
	);
	await page.getByTestId("modal-fork-submit").click();
	const fork = (await (await created).json()) as {
		id: string;
		nodes: { id: string; name: string }[];
	};
	await expect(page.getByTestId("fork-badge")).toContainText("e2e-fork");
	const nodeId = (name: string) =>
		fork.nodes.find((node) => node.name === name)?.id;
	const row = (id: string | null | undefined) =>
		tree.locator(`[data-node-id="${id}"]`);

	// Rename a request of the fork, then merge it back from the fork's page.
	await row(fork.id).click();
	await row(nodeId("Items")).click();
	await row(nodeId("List items")).click();
	await page.getByTestId("request-name").fill("List all items");
	await page.getByTestId("request-head-save").click();
	await row(fork.id).click();
	await page.getByTestId("fork-merge").click();
	const merge = page.getByTestId("modal-merge");
	await expect(merge.getByTestId("sync-changes")).toContainText(
		"List all items",
	);
	await page.getByTestId("modal-merge-submit").click();
	await expect(merge).toHaveCount(0);

	// The source now has the renamed request.
	await row(sourceId).click();
	await expect(page.getByTestId("fork-badge")).toHaveCount(0);
	const source = await api(page, "GET", `/collections/${sourceId}`);
	const renamed = source.nodes.find((node) => node.name === "List all items");
	expect(renamed).toBeDefined();
	// Someone renames it in the source again.
	const patched = await api(
		page,
		"PATCH",
		`/collections/${sourceId}/nodes/${renamed?.id}`,
		{
			name: "Items list",
			draft: { ...renamed?.draft, name: "Items list" },
		},
	);
	expect(patched.nodes ?? patched).toBeTruthy();

	// Pull that into the fork.
	await row(fork.id).click();
	await page.getByTestId("fork-pull").click();
	await expect(page.getByTestId("sync-changes")).toContainText("Items list");
	await page.getByTestId("modal-pull-submit").click();
	await expect(page.getByTestId("modal-pull")).toHaveCount(0);
	const pulled = await api(page, "GET", `/collections/${fork.id}`);
	expect(pulled.nodes.map((node) => node.name)).toContain("Items list");
});
