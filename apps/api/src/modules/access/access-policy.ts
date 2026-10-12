import { OperationError } from "@localman/operations";
import {
	type ElementAction,
	type ElementRole,
	type ShareableElementType,
	elementRoleAllows,
	elementRoleFromWorkspace,
	strongerElementRole,
} from "@localman/shared/access";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { type ElementRecord, elementAdapter } from "./element-adapters.js";
import { ElementRoleModel } from "./element-role-model.js";
import { type ShareRow, claimEmailShare } from "./email-share-claim.js";

/**
 * The role `sub` holds on the element, `null` when none: the stronger of
 * the role their workspace role gives (Admin and Editor edit, Viewer
 * views) and the role shared with them on this element. A share can raise
 * the workspace role, never lower it. A share addressed to the caller's
 * IdP-verified email becomes theirs here, on first use; `claim: false`
 * only reads (showing another element's name must not claim it).
 */
export async function elementRoleOf(
	sub: string,
	element: ElementRecord,
	{ claim = true }: { claim?: boolean } = {},
): Promise<ElementRole | null> {
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	const fromWorkspace = workspace
		? elementRoleFromWorkspace(await workspaceRoleOf(sub, workspace))
		: null;
	// The caller's own share and the email shares nobody claimed yet; each
	// branch names the element so its compound partial index serves it.
	const key = { elementType: element.type, elementId: element.id };
	const rows = await ElementRoleModel.find(
		{
			$or: [
				{ ...key, userId: sub },
				{ ...key, email: { $exists: true } },
			],
		},
		{ userId: 1, email: 1, role: 1 },
	).lean<ShareRow[]>();
	const own = rows.find((row) => row.userId === sub)?.role ?? null;
	// A share to their verified email may arrive on top of an account share.
	const claimed = claim ? await claimEmailShare(sub, element, rows) : null;
	return strongerElementRole(fromWorkspace, strongerElementRole(own, claimed));
}

/** Whether `sub` may perform `action` on the element. */
export async function canOnElement<T extends ShareableElementType>(
	sub: string,
	element: ElementRecord & { readonly type: T },
	action: ElementAction<T>,
): Promise<boolean> {
	return elementRoleAllows(
		element.type,
		await elementRoleOf(sub, element),
		action,
	);
}

/** An element with the caller's role on it. */
export interface ElementAccess {
	readonly element: ElementRecord;
	readonly role: ElementRole;
}

export function elementNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Element not found");
}

/** The element of `type` with this id, `null` when there is none (yet). */
export async function loadElement(
	type: ShareableElementType,
	id: string,
): Promise<ElementRecord | null> {
	const adapter = elementAdapter(type);
	return adapter ? adapter.load(id) : null;
}

/**
 * The element if `sub` may perform `action` on it. An element type that
 * does not exist yet, a missing element and one the caller holds no role
 * on all answer 404, so an element's existence never leaks; a role that
 * lacks the action answers 403.
 */
export async function requireElement(
	sub: string,
	type: ShareableElementType,
	id: string,
	action: ElementAction<ShareableElementType>,
): Promise<ElementAccess> {
	const element = await loadElement(type, id);
	const role = element ? await elementRoleOf(sub, element) : null;
	if (!element || role === null) throw elementNotFound();
	if (!elementRoleAllows(type, role, action)) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return { element, role };
}
