import { createRequestDraft, importText } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	collectionFile,
	environmentFile,
	fileSlug,
	openApiFile,
} from "./export-files";

const requests = [
	{
		id: "t1",
		draft: createRequestDraft({
			name: "List users",
			url: "https://api.test/users",
		}),
	},
	{
		id: "t2",
		draft: createRequestDraft({
			name: "Same path",
			url: "https://api.test/users",
		}),
	},
];

describe("export files", () => {
	it("slugs names for file names", () => {
		expect(fileSlug("Đơn hàng API")).toBe("don-hang-api");
		expect(fileSlug("***")).toBe("localman");
	});

	it("writes a collection that imports back", () => {
		const file = collectionFile("My API", requests);
		expect(file.filename).toBe("my-api.collection.json");
		const back = importText(file.json);
		expect(back.ok && back.value.format).toBe("collection-v21");
	});

	it("counts requests OpenAPI leaves out", () => {
		const file = openApiFile("My API", requests);
		expect(file.filename).toBe("my-api.openapi.json");
		expect(file.skipped).toBe(1);
		expect(JSON.parse(file.json)).toHaveProperty("paths./users.get");
	});

	it("never writes secret values of an environment", () => {
		const file = environmentFile({
			name: "Prod",
			variables: [
				{ key: "host", value: "api.test" },
				{ key: "token", value: "s3cret", secret: true },
			],
		});
		expect(file.json).not.toContain("s3cret");
		const back = importText(file.json);
		if (!back.ok || back.value.format !== "environment-v21") {
			throw new Error("expected an environment");
		}
		expect(back.value.variables).toEqual([
			{ key: "host", value: "api.test", secret: false, enabled: true },
			{ key: "token", value: "", secret: true, enabled: true },
		]);
	});
});
