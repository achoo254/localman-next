import { describe, expect, it } from "vitest";
import {
	importCollection,
	readFixture,
	withoutIds,
} from "../import/import-test-utils.js";
import { flattenImportedRequests } from "../import/imported-collection.js";
import {
	exportChecked,
	roundTrip,
	treeOf,
	v21SchemaErrors,
} from "./v21-schema-test-utils.js";

describe("Postman export round trip", () => {
	const fixture = readFixture("collection-v21-nested.json");
	const first = importCollection(fixture);
	const flat = flattenImportedRequests(first);

	it("starts from a valid v2.1 document", () => {
		expect(v21SchemaErrors(JSON.parse(fixture))).toEqual([]);
	});

	it("keeps three folder levels", () => {
		expect(flat.map((r) => [r.folderPath.join("/"), r.name])).toEqual([
			["Orders", "List orders"],
			["Orders/Fulfilment", "Ship order"],
			["Orders/Fulfilment/Refunds", "Refund order"],
			["Orders/Fulfilment/Refunds", "Refund status"],
			["", "Upload catalog"],
		]);
		expect(flat[3]?.inheritedAuth).toEqual({ type: "none" });
		expect(flat[1]?.draft.url).toBe("{{baseUrl}}/orders/42/ship");
	});

	it("reads saved responses as examples", () => {
		const [listOrders, shipOrder] = first.items.flatMap((item) =>
			item.kind === "folder" ? item.items : [],
		);
		if (listOrders?.kind !== "request") throw new Error("no List orders");
		const [twoOpen] = listOrders.examples;
		expect(twoOpen?.name).toBe("Two open orders");
		expect(twoOpen?.request.url).toBe("{{baseUrl}}/orders?status=open");
		expect(twoOpen?.response).toMatchObject({
			status: 200,
			statusText: "OK",
			body: '[{"id": 1}, {"id": 2}]',
			bodyLanguage: "json",
		});
		if (shipOrder?.kind !== "folder") throw new Error("no Fulfilment");
		const [ship] = shipOrder.items;
		if (ship?.kind !== "request") throw new Error("no Ship order");
		const [accepted] = ship.examples;
		// No `originalRequest`: the item's own request; "Text" read as text.
		expect(accepted?.request.url).toBe("{{baseUrl}}/orders/42/ship");
		expect(accepted?.response).toMatchObject({
			status: 202,
			statusText: "Accepted",
			body: "queued",
			bodyLanguage: "text",
		});
		expect(
			accepted?.response.headers.map((h) => [h.key, h.enabled, h.description]),
		).toEqual([
			["Content-Type", true, undefined],
			["Retry-After", false, "Seconds"],
		]);
	});

	it("imports, exports and imports to the same tree", () => {
		const second = roundTrip(first);
		expect(withoutIds(treeOf(second))).toEqual(withoutIds(treeOf(first)));
	});

	it("exports the same document on every pass", () => {
		const once = exportChecked(first);
		const twice = exportChecked(importCollection(once));
		expect(JSON.parse(twice)).toEqual(JSON.parse(once));
	});
});
