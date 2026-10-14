/** TEST ONLY. A collection holding every kind of secret public views hide. */
import {
	type CollectionTree,
	type KeyValueRow,
	createRequestDraft,
} from "@localman/shared/api-client";
import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { ADA, EVE } from "../../access/testing/access-fixture.js";
import {
	createAs,
	teamOfThree,
} from "../../collections/testing/collection-fixture.js";

const row = (key: string, value: string): KeyValueRow => ({
	id: `r-${key}`,
	key,
	value,
	enabled: true,
});

const login = createRequestDraft({
	name: "Login",
	url: "https://ann:hunter2@api.test/login?api_key=sk_live_query&user={{userId}}",
	headers: [
		row("Authorization", "Bearer header-token"),
		row("X-API-Key", "header-api-key"),
		row("Cookie", "sid=cookie-value"),
		row("Accept", "application/json"),
	],
	auth: { type: "basic", username: "ann", password: "basic-password" },
});

export const SENSITIVE_TREE: CollectionTree = {
	name: "Payments",
	description: "Payments API",
	auth: { type: "bearer", token: "root-token" },
	variables: [
		{ key: "baseUrl", value: "https://api.test" },
		{ key: "apiSecret", value: "secret-variable", secret: true },
	],
	scripts: { pre: "", post: "" },
	tags: [],
	status: null,
	items: [
		{
			kind: "folder",
			id: "f1",
			name: "admin",
			description: "",
			auth: { type: "apikey", key: "X-Key", value: "folder-key", in: "header" },
			scripts: { pre: "", post: "" },
			items: [
				{
					kind: "request",
					id: "r1",
					name: "Login",
					description: "Signs in",
					draft: login,
					examples: [
						{
							id: "e1",
							name: "200",
							request: login,
							response: {
								status: 200,
								statusText: "OK",
								headers: [
									row("Set-Cookie", "sid=set-cookie-value"),
									row("Content-Type", "application/json"),
								],
								body: '{"session":"response-body-token"}',
								bodyLanguage: "json",
							},
						},
					],
				},
			],
		},
	],
};

/** Every literal the public views must never return. */
export const SECRET_LITERALS = [
	"root-token",
	"secret-variable",
	"folder-key",
	"header-token",
	"header-api-key",
	"cookie-value",
	"set-cookie-value",
	"response-body-token",
	"basic-password",
	"sk_live_query",
	"hunter2",
];

/** No secret of `SENSITIVE_TREE` anywhere in `payload`. */
export function expectNoSecrets(payload: unknown): void {
	const json = JSON.stringify(payload);
	for (const literal of SECRET_LITERALS) expect(json).not.toContain(literal);
}

/** `teamOfThree` (Ada admin, Eve editor, Vic viewer) with Eve's sensitive collection. */
export async function sensitiveCollection(): Promise<{
	ws: string;
	id: string;
}> {
	const ws = (await teamOfThree()).toHexString();
	const { id } = await createAs(EVE, ws, { tree: SENSITIVE_TREE });
	return { ws, id };
}

/** Turns a link on as `sub` (expects 200) and returns its id. */
export async function enableLinkAs(
	sub: string,
	collectionId: string,
	kind: "public" | "guest",
): Promise<string> {
	const res = await as(sub).send(
		"post",
		`/collections/${collectionId}/${kind}-link`,
	);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	const url: string = res.body.link.url;
	return url.slice(url.lastIndexOf("/") + 1);
}

/** Sets the workspace's switches as Ada, its Admin. */
export async function setSharing(ws: string, body: object): Promise<void> {
	const res = await as(ADA).send("patch", `/workspaces/${ws}/sharing`, body);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
}
