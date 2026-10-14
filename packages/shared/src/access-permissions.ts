/**
 * Who may do what with workspaces and their elements, as data: the
 * permission tables of Postman's "Roles and permissions" page, one key per
 * row, the roles that hold it as the value. The API decides with these
 * tables (`apps/api/src/modules/access/access-policy.ts`) and the web reads
 * them to hide or disable controls, so both always agree.
 *
 * Postman rows about objects Localman does not have (specifications, flows,
 * monitors, integrations, APIs) are left out; every other row is here.
 */

export const WORKSPACE_TYPES = ["personal", "team"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

/** `public` is set by public sharing (later); personal workspaces stay personal. */
export const WORKSPACE_VISIBILITIES = ["personal", "team", "public"] as const;
export type WorkspaceVisibility = (typeof WORKSPACE_VISIBILITIES)[number];

export const WORKSPACE_ROLES = ["admin", "editor", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ELEMENT_ROLES = ["editor", "viewer"] as const;
export type ElementRole = (typeof ELEMENT_ROLES)[number];

/** Elements that live in a workspace and can be shared person by person. */
export const SHAREABLE_ELEMENT_TYPES = ["collection", "environment"] as const;
export type ShareableElementType = (typeof SHAREABLE_ELEMENT_TYPES)[number];

/** Workspace roles: Postman's workspace table. */
export const WORKSPACE_PERMISSIONS = {
	/** Join and leave the workspace. */
	joinLeave: ["admin", "editor", "viewer"],
	/** Send requests (and see every element of the workspace). */
	sendRequests: ["admin", "editor", "viewer"],
	/** Add collections and environments. */
	addElements: ["admin", "editor"],
	/** Move and delete collections and environments. */
	moveDeleteElements: ["admin", "editor"],
	/** Restore and permanently delete collections. */
	restoreElements: ["admin", "editor"],
	/** Add and delete mock servers. */
	manageMocks: ["admin", "editor"],
	/** Move mock servers. */
	moveMocks: ["admin", "editor"],
	/** Create and delete workspaces. */
	createDeleteWorkspace: ["admin"],
	/** Edit the workspace details (name, description). */
	editDetails: ["admin"],
	/** Add and remove members. */
	manageMembers: ["admin"],
	/** Manage workspace roles. */
	manageRoles: ["admin"],
	/** Manage workspace visibility. */
	manageVisibility: ["admin"],
	/**
	 * Take a collection outside the workspace: public and guest links,
	 * access keys, Run buttons. Members only: a person shared one element
	 * cannot publish it.
	 */
	publishPublic: ["admin", "editor"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;
export type WorkspaceAction = keyof typeof WORKSPACE_PERMISSIONS;

/** Collection roles: Postman's collection table, plus `view`. */
export const COLLECTION_PERMISSIONS = {
	/** Implicit in Postman: any role on a collection opens it. */
	view: ["editor", "viewer"],
	/** Edit, delete and restore the collection. */
	edit: ["editor"],
	viewDeleted: ["editor", "viewer"],
	manageRoles: ["editor"],
	export: ["editor", "viewer"],
	fork: ["editor", "viewer"],
	mergeFork: ["editor"],
	/** Publish the collection documentation. */
	publishDocs: ["editor"],
	shareVariables: ["editor"],
	/** Share the collection to a different workspace. */
	shareToWorkspace: ["editor", "viewer"],
	tag: ["editor"],
	/** Add, edit and delete mock servers of the collection. */
	manageMocks: ["editor"],
} as const satisfies Record<string, readonly ElementRole[]>;
export type CollectionAction = keyof typeof COLLECTION_PERMISSIONS;

/** Environment roles: Postman's environment table. */
export const ENVIRONMENT_PERMISSIONS = {
	view: ["editor", "viewer"],
	use: ["editor", "viewer"],
	/** Edit variable values; a Viewer's edits stay local (current values). */
	editLocalValues: ["editor", "viewer"],
	/** Share variable values with everyone who can see the environment. */
	shareVariables: ["editor"],
	/** Edit and delete the environment. */
	edit: ["editor"],
	manageRoles: ["editor"],
} as const satisfies Record<string, readonly ElementRole[]>;
export type EnvironmentAction = keyof typeof ENVIRONMENT_PERMISSIONS;

export const ELEMENT_PERMISSIONS = {
	collection: COLLECTION_PERMISSIONS,
	environment: ENVIRONMENT_PERMISSIONS,
} as const;

export type ElementAction<T extends ShareableElementType> =
	keyof (typeof ELEMENT_PERMISSIONS)[T];

/**
 * Mock projects keep their own members (owner and collaborators) and no
 * workspace: the owner is an Editor who also manages the project, a
 * collaborator an Editor who does not.
 */
export const MOCK_PROJECT_PERMISSIONS = {
	read: ["owner", "collaborator"],
	editResources: ["owner", "collaborator"],
	clone: ["owner", "collaborator"],
	update: ["owner"],
	delete: ["owner"],
	manageMembers: ["owner"],
} as const satisfies Record<string, readonly ("owner" | "collaborator")[]>;
export type MockProjectAction = keyof typeof MOCK_PROJECT_PERMISSIONS;

function listed<R extends string>(roles: readonly R[], role: R): boolean {
	return roles.includes(role);
}

export function workspaceRoleAllows(
	role: WorkspaceRole | null,
	action: WorkspaceAction,
): boolean {
	return role !== null && listed(WORKSPACE_PERMISSIONS[action], role);
}

export function elementRoleAllows<T extends ShareableElementType>(
	type: T,
	role: ElementRole | null,
	action: ElementAction<T>,
): boolean {
	if (role === null) return false;
	const table: Record<PropertyKey, readonly ElementRole[]> =
		ELEMENT_PERMISSIONS[type];
	return listed(table[action] ?? [], role);
}

/**
 * The role a workspace member holds on every element of the workspace:
 * Admins and Editors edit them, Viewers view them.
 */
export function elementRoleFromWorkspace(
	role: WorkspaceRole | null,
): ElementRole | null {
	if (role === null) return null;
	return role === "viewer" ? "viewer" : "editor";
}

/** The stronger of two element roles (an explicit share can raise, never lower). */
export function strongerElementRole(
	a: ElementRole | null,
	b: ElementRole | null,
): ElementRole | null {
	if (a === "editor" || b === "editor") return "editor";
	return a ?? b;
}
