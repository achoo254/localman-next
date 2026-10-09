import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import {
	RESOURCES_PATH,
	findNode,
	renderDetail,
	resourceJson,
} from "../../pages/project-detail/project-detail-test-helpers";
import { downloadText } from "../../platform/download";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { exportSetOf } from "./export-types";
import { parseResource } from "./resource-model";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

const tree = () => [
	resourceJson("users", {
		schema: [
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			{ name: "posts", type: "Child Resource", childId: "posts" },
		],
	}),
	resourceJson("posts", { parentId: "users", parentKey: "userId", depth: 1 }),
	resourceJson("tags"),
];

function stubClipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
}

async function openMenu(name: string) {
	renderDetail(
		{ [`GET ${RESOURCES_PATH}`]: { body: { items: tree() } } },
		undefined,
		{ flags: ALL_FEATURES },
	);
	const node = await findNode(name);
	await userEvent.click(
		within(node).getByRole("button", { name: `Export types of ${name}` }),
	);
	return screen.findByRole("menu");
}

describe("Export types", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("exports a resource with the children its fields embed, nothing else", () => {
		const resources = tree().map(parseResource);
		const [users, posts] = resources;
		if (!users || !posts) throw new Error("fixtures");
		expect(exportSetOf(users, resources).map((r) => r.name)).toEqual([
			"users",
			"posts",
		]);
		expect(exportSetOf(posts, resources)).toMatchObject([
			{ name: "posts", parentKey: "userId" },
		]);
	});

	it("copies the TypeScript of a node", async () => {
		const writeText = vi.fn(async (_text: string) => undefined);
		stubClipboard(writeText);
		const menu = await openMenu("users");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Copy TypeScript" }),
		);
		expect(
			await findToast("Copied the TypeScript types of users."),
		).toBeInTheDocument();
		const code = writeText.mock.calls[0]?.[0] ?? "";
		expect(code).toContain("export interface User extends UserRecord");
		expect(code).toContain("posts: Post[];");
	});

	it("says so when the browser blocks copying", async () => {
		stubClipboard(async () => {
			throw new Error("denied");
		});
		const menu = await openMenu("tags");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Copy Zod schema" }),
		);
		const toast = await findToast("Your browser blocked copying.");
		expect(toast).toHaveAttribute("data-tone", "info");
	});

	it("downloads the Zod schema as a .schema.ts file", async () => {
		const menu = await openMenu("posts");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Download posts.schema.ts" }),
		);
		expect(await findToast("Downloaded posts.schema.ts.")).toBeInTheDocument();
		const [file, text, type] = vi.mocked(downloadText).mock.calls[0] ?? [];
		expect(file).toBe("posts.schema.ts");
		expect(type).toBe("text/typescript;charset=utf-8");
		expect(text).toContain('import { z } from "zod";');
		expect(text).toContain("userId: z.string()");
	});
});
