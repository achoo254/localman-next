import { describe, expect, it } from "vitest";
import { createRequestDraft } from "../request-model.js";
import { applyCollectionVariables } from "./apply-collection-variables.js";
import { importCollection, readFixture } from "./import-test-utils.js";
import {
	countImportedRequests,
	flattenImportedRequests,
} from "./imported-collection.js";

const fixture = readFixture("collection-v21-sample.json");

describe("Collection v2.1 import", () => {
	const imported = importCollection(fixture);
	const flat = flattenImportedRequests(imported);
	const byName = (name: string) => {
		const found = flat.find((r) => r.name === name);
		if (!found) throw new Error(`no request ${name}`);
		return found;
	};

	it("keeps the collection's name, auth, variables and scripts", () => {
		expect(imported.format).toBe("collection-v21");
		expect(imported.name).toBe("Shop API");
		expect(imported.description).toBe("Orders and users of the sample shop.");
		expect(imported.auth).toEqual({ type: "bearer", token: "{{token}}" });
		expect(imported.variables).toEqual([
			{
				key: "baseUrl",
				value: "https://api.example.com",
				secret: false,
				enabled: true,
			},
			{ key: "token", value: "abc", secret: true, enabled: true },
			{ key: "unused", value: "", secret: false, enabled: false },
		]);
		expect(imported.scripts.pre).toBe('lm.variables.set("ts", Date.now());');
	});

	it("keeps nested folders in order", () => {
		expect(countImportedRequests(imported.items)).toBe(6);
		expect(flat.map((r) => [r.folderPath.join("/"), r.name])).toEqual([
			["Users", "List users"],
			["Users", "Get user"],
			["Users/Admin", "Create user"],
			["", "Upload avatar"],
			["", "Login"],
			["", "Search (GraphQL)"],
		]);
	});

	it("resolves auth inheritance through folders", () => {
		expect(byName("List users").draft.auth).toEqual({ type: "inherit" });
		expect(byName("List users").inheritedAuth).toEqual(imported.auth);
		expect(byName("Get user").draft.auth).toEqual({ type: "none" });
		expect(byName("Create user").inheritedAuth).toEqual({
			type: "basic",
			username: "admin",
			password: "{{adminPass}}",
		});
		expect(byName("Upload avatar").draft.auth).toEqual({
			type: "apikey",
			key: "api_key",
			value: "{{apiKey}}",
			in: "query",
		});
	});

	it("reads URLs, params, headers and settings", () => {
		const list = byName("List users").draft;
		expect(list.url).toBe("{{baseUrl}}/users?page=1&limit=20");
		expect(
			list.params.map((p) => [p.key, p.value, p.enabled, p.description]),
		).toEqual([
			["page", "1", true, undefined],
			["limit", "20", true, undefined],
			["sort", "name", false, "Sort field"],
		]);
		expect(list.headers.map((h) => [h.key, h.enabled])).toEqual([
			["Accept", true],
			["X-Debug", false],
		]);
		expect(list.scripts.post).toContain("pm.response.to.have.status(200);");
		expect(byName("Get user").draft.url).toBe("{{baseUrl}}/users/42");
		expect(byName("Upload avatar").draft.url).toBe(
			"https://api.example.com:8443/v1/avatar",
		);
		const create = byName("Create user");
		expect(create.draft.settings.followRedirects).toBe(false);
		expect(create.description).toBe("Creates a user.");
	});

	it("reads every body kind", () => {
		expect(byName("Create user").draft.body).toMatchObject({
			type: "raw",
			rawLanguage: "json",
			raw: '{\n  "name": "Ann",\n  "note": "it\'s $5"\n}',
		});
		expect(
			byName("Login").draft.body.urlencoded.map((r) => [r.key, r.value]),
		).toEqual([
			["user", "ann"],
			["pass", "s3cret"],
		]);
		expect(
			byName("Upload avatar").draft.body.formData.map((r) => [
				r.key,
				r.kind,
				r.value,
			]),
		).toEqual([
			["caption", "text", "Me"],
			["file", "file", ""],
		]);
		expect(JSON.parse(byName("Search (GraphQL)").draft.body.raw)).toEqual({
			query: "query { users { id } }",
			variables: { first: 2 },
		});
	});

	it("reports what it could not keep", () => {
		expect(imported.warnings.map((w) => [w.code, w.path, w.params])).toEqual([
			["SCRIPT_REVIEW", "Users / List users", {}],
			["FILE_NOT_INCLUDED", "Upload avatar", { name: "/Users/me/avatar.png" }],
			["UNSUPPORTED_AUTH", "Search (GraphQL)", { type: "oauth2" }],
		]);
	});

	it("fills collection variables when a request opens", () => {
		const opened = applyCollectionVariables(
			byName("List users").draft,
			imported.variables,
		);
		expect(opened.url).toBe("https://api.example.com/users?page=1&limit=20");
		const keep = applyCollectionVariables(
			createRequestDraft({ url: "{{baseUrl}}/{{$guid}}/{{other}}" }),
			[{ key: " baseUrl ", value: "https://x.dev/{{nested}}" }],
		);
		expect(keep.url).toBe("https://x.dev/{{nested}}/{{$guid}}/{{other}}");
	});
});
