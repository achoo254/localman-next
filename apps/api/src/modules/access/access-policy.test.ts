import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { roleAllows } from "../projects/project-access.js";
import {
	canOnElement,
	elementRoleOf,
	requireElement,
} from "./access-policy.js";
import { resetElementAdapters } from "./element-adapters.js";
import { ElementRoleModel } from "./element-role-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	UNA,
	VIC,
	addElement,
	personalWorkspace,
	teamWorkspace,
	useAccessTestDb,
} from "./testing/access-fixture.js";

useAccessTestDb();

async function share(
	elementId: string,
	who: { userId: string } | { email: string },
	role: "editor" | "viewer",
): Promise<void> {
	await ElementRoleModel.create({
		elementType: "collection",
		elementId,
		...who,
		role,
		grantedBy: ADA,
	});
}

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
	try {
		await promise;
		return null;
	} catch (error) {
		if (error instanceof OperationError) return error.status;
		throw error;
	}
}

describe("elementRoleOf", () => {
	it("derives the role from a team workspace role", async () => {
		const ws = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "editor",
			[VIC]: "viewer",
		});
		const element = addElement("collection", ws);
		expect(await elementRoleOf(ADA, element)).toBe("editor");
		expect(await elementRoleOf(EVE, element)).toBe("editor");
		expect(await elementRoleOf(VIC, element)).toBe("viewer");
		expect(await elementRoleOf(OLLIE, element)).toBeNull();
	});

	it("gives a personal workspace's elements to its owner only", async () => {
		const element = addElement("environment", await personalWorkspace(EVE));
		expect(await elementRoleOf(EVE, element)).toBe("editor");
		expect(await elementRoleOf(ADA, element)).toBeNull();
	});

	it("lets a share raise the workspace role, never lower it", async () => {
		const ws = await teamWorkspace({
			[ADA]: "admin",
			[EVE]: "editor",
			[VIC]: "viewer",
		});
		const element = addElement("collection", ws);
		await share(element.id, { userId: VIC }, "editor");
		await share(element.id, { userId: EVE }, "viewer");
		await share(element.id, { userId: OLLIE }, "viewer");
		expect(await elementRoleOf(VIC, element)).toBe("editor");
		expect(await elementRoleOf(EVE, element)).toBe("editor");
		expect(await elementRoleOf(OLLIE, element)).toBe("viewer");
	});

	it("lets the account with the verified email claim an email share", async () => {
		const element = addElement(
			"collection",
			await teamWorkspace({ [ADA]: "admin" }),
		);
		await share(element.id, { email: "ollie@example.com" }, "editor");
		expect(await elementRoleOf(ADA, element)).toBe("editor");
		expect(await elementRoleOf(OLLIE, element)).toBe("editor");
		const row = await ElementRoleModel.findOne({
			elementId: element.id,
		}).lean();
		expect(row?.userId).toBe(OLLIE);
		expect(row?.email).toBeUndefined();
		expect(await elementRoleOf(OLLIE, element)).toBe("editor");
	});

	it("never lets an unverified email claim a share", async () => {
		const element = addElement(
			"collection",
			await teamWorkspace({ [ADA]: "admin" }),
		);
		await share(element.id, { email: "una@example.com" }, "viewer");
		expect(await elementRoleOf(UNA, element)).toBeNull();
		const row = await ElementRoleModel.findOne({
			elementId: element.id,
		}).lean();
		expect(row?.email).toBe("una@example.com");
		expect(row?.userId).toBeUndefined();
	});
});

describe("element_roles indexes and claims", () => {
	it("merges a verified email share into the account share, stronger role wins", async () => {
		const element = addElement(
			"collection",
			await teamWorkspace({ [ADA]: "admin" }),
		);
		await share(element.id, { userId: OLLIE }, "viewer");
		await share(element.id, { email: "ollie@example.com" }, "editor");
		expect(await elementRoleOf(OLLIE, element)).toBe("editor");
		const rows = await ElementRoleModel.find().lean();
		expect(rows).toEqual([
			expect.objectContaining({ userId: OLLIE, role: "editor" }),
		]);
	});

	it("index the access list sort, not emails across elements", async () => {
		const names = (await ElementRoleModel.collection.indexes()).map(
			(index) => index.name,
		);
		expect(names).toContain("tenantId_1_elementType_1_elementId_1_createdAt_1");
		expect(names).not.toContain("tenantId_1_email_1");
	});
});

describe("requireElement and canOnElement", () => {
	it("answer 404 without an adapter, element or role, 403 without the action", async () => {
		const ws = await teamWorkspace({ [ADA]: "admin", [VIC]: "viewer" });
		const element = addElement("collection", ws);
		expect(
			await statusOf(requireElement(OLLIE, "collection", element.id, "view")),
		).toBe(404);
		expect(
			await statusOf(requireElement(ADA, "collection", "missing", "view")),
		).toBe(404);
		expect(
			await statusOf(requireElement(ADA, "environment", element.id, "view")),
		).toBe(404);
		expect(
			await statusOf(requireElement(VIC, "collection", element.id, "edit")),
		).toBe(403);
		expect(await requireElement(VIC, "collection", element.id, "view")).toEqual(
			{
				element,
				role: "viewer",
			},
		);
		expect(await canOnElement(VIC, element, "export")).toBe(true);
		expect(await canOnElement(VIC, element, "manageRoles")).toBe(false);
		expect(await canOnElement(ADA, element, "manageRoles")).toBe(true);
		resetElementAdapters();
		expect(
			await statusOf(requireElement(ADA, "collection", element.id, "view")),
		).toBe(404);
	});
});

describe("mock project roles", () => {
	it("decide through the shared table", () => {
		for (const action of ["read", "editResources", "clone"] as const) {
			expect(roleAllows("owner", action)).toBe(true);
			expect(roleAllows("collaborator", action)).toBe(true);
			expect(roleAllows(null, action)).toBe(false);
		}
		for (const action of ["update", "delete", "manageMembers"] as const) {
			expect(roleAllows("owner", action)).toBe(true);
			expect(roleAllows("collaborator", action)).toBe(false);
			expect(roleAllows(null, action)).toBe(false);
		}
	});
});
