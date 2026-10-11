import { describe, expect, it } from "vitest";
import {
	importCollection,
	readFixture,
	withBlankSecrets,
	withoutIds,
} from "../import/import-test-utils.js";
import { importText } from "../import/import-text.js";
import { collectionFromDrafts } from "../import/imported-collection.js";
import { createRequestDraft } from "../request-model.js";
import { exportCollectionV21 } from "./collection-v21-export.js";
import { v21SchemaErrors } from "./v21-schema-test-utils.js";

const fixture = readFixture("collection-v21-sample.json");

describe("Collection v2.1 round trip", () => {
	it("imports its own export to the same tree", () => {
		const first = importCollection(fixture);
		const document = exportCollectionV21(first);
		expect(v21SchemaErrors(document)).toEqual([]);
		const exported = JSON.stringify(document);
		const second = importCollection(exported);
		const { warnings: _a, ...firstTree } = first;
		const { warnings: _b, ...secondTree } = second;
		expect(withoutIds(secondTree)).toEqual(
			withoutIds(withBlankSecrets(firstTree)),
		);
	});

	it("exports open tabs as a flat collection", () => {
		const draft = createRequestDraft({
			name: "Ping",
			url: "https://a.com/ping?x=1",
		});
		const exported = exportCollectionV21(
			collectionFromDrafts("Tabs", [{ id: "t1", draft }]),
		);
		expect(v21SchemaErrors(exported)).toEqual([]);
		expect(exported.info.schema).toContain("/collection/v2.1.0/");
		expect(exported.auth).toBeUndefined();
		expect(exported.item).toEqual([
			{
				name: "Ping",
				request: {
					method: "GET",
					header: [],
					url: {
						raw: "https://a.com/ping?x=1",
						protocol: "https",
						host: ["a", "com"],
						path: ["ping"],
						query: [{ key: "x", value: "1" }],
					},
					auth: { type: "noauth" },
				},
			},
		]);
	});
});

describe("environment import", () => {
	it("reads an environment file", () => {
		const result = importText(
			JSON.stringify({
				id: "e1",
				name: "Staging",
				values: [
					{
						key: "baseUrl",
						value: "https://staging.example.com",
						type: "default",
						enabled: true,
					},
					{ key: "token", value: "t", type: "secret", enabled: true },
					{ key: "off", value: "1", enabled: false },
				],
				_postman_variable_scope: "environment",
			}),
		);
		expect(result).toEqual({
			ok: true,
			value: {
				format: "environment-v21",
				name: "Staging",
				variables: [
					{
						key: "baseUrl",
						value: "https://staging.example.com",
						secret: false,
						enabled: true,
					},
					{ key: "token", value: "t", secret: true, enabled: true },
					{ key: "off", value: "1", secret: false, enabled: false },
				],
				warnings: [],
			},
		});
	});
});
