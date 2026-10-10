import { describe, expect, it } from "vitest";
import {
	COLLECTION_PERMISSIONS,
	ENVIRONMENT_PERMISSIONS,
	type ElementRole,
	MOCK_PROJECT_PERMISSIONS,
	WORKSPACE_PERMISSIONS,
	type WorkspaceRole,
	elementRoleAllows,
	elementRoleFromWorkspace,
	strongerElementRole,
	workspaceRoleAllows,
} from "./access-permissions.js";

/*
 * Expected values copied by hand from Postman's "Roles and permissions"
 * page (learning.postman.com/docs/administration/roles-and-permissions),
 * one row per table line, never derived from the tables under test.
 * `Y` = the role holds the permission.
 */
const Y = true;
const N = false;

/** Workspace table: [action, Admin, Editor, Viewer]. */
const WORKSPACE_MATRIX: readonly [
	keyof typeof WORKSPACE_PERMISSIONS,
	boolean,
	boolean,
	boolean,
][] = [
	["joinLeave", Y, Y, Y],
	["sendRequests", Y, Y, Y],
	["addElements", Y, Y, N],
	["moveDeleteElements", Y, Y, N],
	["restoreElements", Y, Y, N],
	["manageMocks", Y, Y, N],
	["moveMocks", Y, Y, N],
	["createDeleteWorkspace", Y, N, N],
	["editDetails", Y, N, N],
	["manageMembers", Y, N, N],
	["manageRoles", Y, N, N],
	["manageVisibility", Y, N, N],
];

/** Collection table: [action, Editor, Viewer]. */
const COLLECTION_MATRIX: readonly [
	keyof typeof COLLECTION_PERMISSIONS,
	boolean,
	boolean,
][] = [
	["view", Y, Y],
	["edit", Y, N],
	["viewDeleted", Y, Y],
	["manageRoles", Y, N],
	["export", Y, Y],
	["fork", Y, Y],
	["mergeFork", Y, N],
	["publishDocs", Y, N],
	["shareVariables", Y, N],
	["shareToWorkspace", Y, Y],
	["tag", Y, N],
	["manageMocks", Y, N],
];

/** Environment table: [action, Editor, Viewer]. */
const ENVIRONMENT_MATRIX: readonly [
	keyof typeof ENVIRONMENT_PERMISSIONS,
	boolean,
	boolean,
][] = [
	["view", Y, Y],
	["use", Y, Y],
	["editLocalValues", Y, Y],
	["shareVariables", Y, N],
	["edit", Y, N],
	["manageRoles", Y, N],
];

/** Mock projects: [action, owner, collaborator]. */
const MOCK_PROJECT_MATRIX: readonly [
	keyof typeof MOCK_PROJECT_PERMISSIONS,
	boolean,
	boolean,
][] = [
	["read", Y, Y],
	["editResources", Y, Y],
	["clone", Y, Y],
	["update", Y, N],
	["delete", Y, N],
	["manageMembers", Y, N],
];

const workspaceCells = WORKSPACE_MATRIX.flatMap(
	([action, admin, editor, viewer]) =>
		(
			[
				["admin", admin],
				["editor", editor],
				["viewer", viewer],
			] as const
		).map(([role, allowed]) => ({ action, role, allowed })),
);

function elementCells<A extends string>(
	matrix: readonly [A, boolean, boolean][],
): { action: A; role: ElementRole; allowed: boolean }[] {
	return matrix.flatMap(([action, editor, viewer]) => [
		{ action, role: "editor" as const, allowed: editor },
		{ action, role: "viewer" as const, allowed: viewer },
	]);
}

describe("workspace permissions (Postman workspace roles)", () => {
	it("cover exactly the rows of the table", () => {
		expect(Object.keys(WORKSPACE_PERMISSIONS).sort()).toEqual(
			WORKSPACE_MATRIX.map(([action]) => action).sort(),
		);
	});

	it.each(workspaceCells)(
		"$role: $action is $allowed",
		({ role, action, allowed }) => {
			expect(workspaceRoleAllows(role, action)).toBe(allowed);
		},
	);

	it.each(WORKSPACE_MATRIX.map(([action]) => action))(
		"no role: %s is refused",
		(action) => {
			expect(workspaceRoleAllows(null, action)).toBe(false);
		},
	);
});

describe("collection permissions (Postman collection roles)", () => {
	it("cover exactly the rows of the table", () => {
		expect(Object.keys(COLLECTION_PERMISSIONS).sort()).toEqual(
			COLLECTION_MATRIX.map(([action]) => action).sort(),
		);
	});

	it.each(elementCells(COLLECTION_MATRIX))(
		"$role: $action is $allowed",
		({ role, action, allowed }) => {
			expect(elementRoleAllows("collection", role, action)).toBe(allowed);
		},
	);

	it.each(COLLECTION_MATRIX.map(([action]) => action))(
		"no role: %s is refused",
		(action) => {
			expect(elementRoleAllows("collection", null, action)).toBe(false);
		},
	);
});

describe("environment permissions (Postman environment roles)", () => {
	it("cover exactly the rows of the table", () => {
		expect(Object.keys(ENVIRONMENT_PERMISSIONS).sort()).toEqual(
			ENVIRONMENT_MATRIX.map(([action]) => action).sort(),
		);
	});

	it.each(elementCells(ENVIRONMENT_MATRIX))(
		"$role: $action is $allowed",
		({ role, action, allowed }) => {
			expect(elementRoleAllows("environment", role, action)).toBe(allowed);
		},
	);

	it.each(ENVIRONMENT_MATRIX.map(([action]) => action))(
		"no role: %s is refused",
		(action) => {
			expect(elementRoleAllows("environment", null, action)).toBe(false);
		},
	);
});

describe("mock project permissions (owner = managing Editor)", () => {
	it("cover exactly the rows of the table", () => {
		expect(Object.keys(MOCK_PROJECT_PERMISSIONS).sort()).toEqual(
			MOCK_PROJECT_MATRIX.map(([action]) => action).sort(),
		);
	});

	it.each(
		MOCK_PROJECT_MATRIX.flatMap(([action, owner, collaborator]) => [
			{ action, role: "owner" as const, allowed: owner },
			{ action, role: "collaborator" as const, allowed: collaborator },
		]),
	)("$role: $action is $allowed", ({ role, action, allowed }) => {
		const roles: readonly string[] = MOCK_PROJECT_PERMISSIONS[action];
		expect(roles.includes(role)).toBe(allowed);
	});
});

describe("element role from the workspace and shares", () => {
	it.each([
		["admin", "editor"],
		["editor", "editor"],
		["viewer", "viewer"],
		[null, null],
	] as [WorkspaceRole | null, ElementRole | null][])(
		"workspace %s gives %s",
		(workspaceRole, elementRole) => {
			expect(elementRoleFromWorkspace(workspaceRole)).toBe(elementRole);
		},
	);

	it.each([
		["viewer", "editor", "editor"],
		["editor", "viewer", "editor"],
		["viewer", "viewer", "viewer"],
		["viewer", null, "viewer"],
		[null, "editor", "editor"],
		[null, null, null],
	] as [ElementRole | null, ElementRole | null, ElementRole | null][])(
		"stronger of %s and %s is %s",
		(a, b, expected) => {
			expect(strongerElementRole(a, b)).toBe(expected);
		},
	);
});
