import type { VariableView } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	upsertCollectionVariable,
	upsertSharedVariable,
} from "./variable-writes";

const view = (
	key: string,
	sharedValue: string | null,
	extra: Partial<VariableView> = {},
): VariableView => ({
	id: `v-${key}`,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
	...extra,
});

describe("upsertSharedVariable", () => {
	it("appends a new variable with the value shared", () => {
		expect(upsertSharedVariable([view("a", "1")], "token", "abc")).toEqual([
			{
				id: "v-a",
				key: "a",
				type: "default",
				enabled: true,
				description: "",
				sharedValue: "1",
			},
			{
				key: "token",
				type: "default",
				enabled: true,
				description: "",
				sharedValue: "abc",
			},
		]);
	});

	it("updates an existing one in place, keeping its id, type and disabled state", () => {
		const writes = upsertSharedVariable(
			[view("token", "old", { type: "secret", enabled: false })],
			" token ",
			"new",
		);
		expect(writes).toEqual([
			{
				id: "v-token",
				key: "token",
				type: "secret",
				enabled: false,
				description: "",
				sharedValue: "new",
			},
		]);
	});

	it("sends a withheld secret back as null so the server keeps it", () => {
		const writes = upsertSharedVariable(
			[view("hidden", null, { type: "secret", sharedHidden: true })],
			"other",
			"x",
		);
		expect(writes[0]).toMatchObject({ id: "v-hidden", sharedValue: null });
	});
});

describe("upsertCollectionVariable", () => {
	it("appends enabled, or replaces by trimmed name keeping the state", () => {
		expect(upsertCollectionVariable([], "id", "7")).toEqual([
			{ key: "id", value: "7", enabled: true },
		]);
		expect(
			upsertCollectionVariable(
				[{ key: " id ", value: "1", enabled: false, secret: true }],
				"id",
				"2",
			),
		).toEqual([{ key: "id", value: "2", enabled: false, secret: true }]);
	});
});
