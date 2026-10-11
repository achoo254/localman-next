import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openApiClient, prettyJsonBody } from "../support/api-client-ui.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import { signIn, uniqueUsername } from "../support/session.js";

/** A Collection v2.1 file as Postman writes it: folders three levels deep. */
function postmanCollection(): Record<string, unknown> {
	return {
		info: {
			_postman_id: "8d3f2a51-0000-4000-8000-000000000001",
			name: "E2E Shop",
			description: "Imported from a Postman export.",
			schema:
				"https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		auth: {
			type: "bearer",
			bearer: [{ key: "token", value: "collection-token", type: "string" }],
		},
		variable: [
			{ key: "baseUrl", value: `${ECHO_ORIGIN}/cors`, type: "string" },
		],
		item: [
			{
				name: "Catalog",
				item: [
					{
						name: "Products",
						item: [
							{
								name: "Variants",
								item: [
									{
										name: "List variants",
										request: {
											method: "GET",
											header: [{ key: "Accept", value: "application/json" }],
											url: {
												raw: "{{baseUrl}}/variants?page=1",
												host: ["{{baseUrl}}"],
												path: ["variants"],
												query: [{ key: "page", value: "1" }],
											},
										},
										response: [],
									},
								],
							},
						],
					},
				],
			},
		],
	};
}

interface V21Item {
	name: string;
	item?: V21Item[];
	request?: { method: string; url: { raw: string } };
}

/** Names, methods and raw URLs of a v2.1 item tree: what must survive. */
function outline(items: readonly V21Item[]): unknown[] {
	return items.map((item) =>
		item.item
			? { folder: item.name, items: outline(item.item) }
			: {
					request: item.name,
					method: item.request?.method,
					url: item.request?.url.raw,
				},
	);
}

test("import a nested Postman collection, send a request with inherited auth, export it", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("collections"));
	await openApiClient(page);
	const source = postmanCollection();

	await page.getByTestId("sidebar-collections-import").click();
	await page.getByTestId("modal-import-text").fill(JSON.stringify(source));
	await page.getByTestId("modal-import-mode-collection").click();
	await page.getByTestId("modal-import-submit").click();
	const tree = page.getByTestId("sidebar-tree");
	await expect(tree.getByText("E2E Shop")).toBeVisible();

	for (const folder of ["E2E Shop", "Catalog", "Products", "Variants"]) {
		await tree.getByText(folder, { exact: true }).click();
	}
	await tree.getByText("List variants").click();
	await expect(page.getByTestId("request-breadcrumb")).toContainText(
		"Variants",
	);
	await page.getByTestId("request-send").click();
	await expect(page.getByTestId("response-body").first()).toBeVisible();
	const echo = await prettyJsonBody(page);
	expect(echo).toMatchObject({ method: "GET", url: "/cors/variants?page=1" });
	const headers = (echo as { headers: [string, string][] }).headers.map(
		([name, value]) => [name.toLowerCase(), value],
	);
	expect(headers).toContainEqual(["authorization", "Bearer collection-token"]);

	const row = tree
		.getByTestId("sidebar-tree-collection")
		.filter({ hasText: "E2E Shop" });
	await row.hover();
	await row.getByTestId("sidebar-tree-more").click();
	const download = page.waitForEvent("download");
	await page.getByTestId("node-menu-export").click();
	const file = await (await download).path();
	const exported = JSON.parse(await readFile(file, "utf8")) as {
		info: { name: string };
		item: V21Item[];
		variable: { key: string; value: string }[];
		auth: unknown;
	};
	expect(exported.info.name).toBe("E2E Shop");
	expect(exported.auth).toEqual(source.auth);
	expect(exported.variable).toEqual([
		expect.objectContaining({ key: "baseUrl", value: `${ECHO_ORIGIN}/cors` }),
	]);
	expect(outline(exported.item)).toEqual(outline(source.item as V21Item[]));
});
