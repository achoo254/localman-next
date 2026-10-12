import { OperationError } from "@localman/operations";
import type { ElementRole } from "@localman/shared/access";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { type Logger, createLogger } from "../../logger.js";
import { takeInviteLookupSlot } from "../collaborators/invite-rate-limits.js";
import {
	type InviteTarget,
	resolveInviteTarget,
} from "../collaborators/invitee-lookup.js";
import { rememberSharedEnvironment } from "../collections/collection-links.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { requireElement } from "./access-policy.js";
import { displayNameOf } from "./display-name.js";
import { elementPath } from "./element-access-view.js";
import type { ElementRecord } from "./element-adapters.js";
import { ElementRoleModel } from "./element-role-model.js";

/** Who a share goes to: an account, or an email nobody uses yet. */
export type ShareAddressee =
	| { readonly userId: string }
	| { readonly email: string };

/**
 * An element whose workspace was deleted. Only people it is shared with
 * still reach it (others get 404 first), and Manage access already shows
 * them the workspace is gone, so saying so leaks nothing.
 */
export function workspaceMissing(): OperationError {
	return new OperationError(
		409,
		"WORKSPACE_MISSING",
		"The workspace of this element no longer exists",
	);
}

/**
 * Elements of a personal workspace are not shared (as in Postman): their
 * owner moves them to a team workspace first. Neither are elements whose
 * workspace is gone.
 */
export async function assertShareable(element: ElementRecord): Promise<void> {
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	if (!workspace) throw workspaceMissing();
	if (workspace.type === "personal") {
		throw new OperationError(
			409,
			"PERSONAL_WORKSPACE",
			"Move it to a team workspace to share it",
		);
	}
}

/**
 * Shares the element with `addressee` as `role`, or raises the role of an
 * existing share to it; a share is never lowered here (Manage access sets
 * any role with `updateShare`).
 */
export async function grantElementRole(
	element: ElementRecord,
	addressee: ShareAddressee,
	role: ElementRole,
	grantedBy: string,
): Promise<void> {
	const filter = {
		elementType: element.type,
		elementId: element.id,
		...addressee,
	};
	const update =
		role === "editor"
			? { $set: { role }, $setOnInsert: { grantedBy } }
			: { $setOnInsert: { role, grantedBy } };
	try {
		await ElementRoleModel.updateOne(filter, update, { upsert: true });
	} catch (error) {
		// Two upserts raced: the loser updates the row the winner inserted.
		if (!isDuplicateKeyError(error)) throw error;
		await ElementRoleModel.updateOne(filter, update);
	}
}

/**
 * Who a share is stored for. A username names its account; an email binds
 * to the account using it only when the IdP verified that email, else the
 * share stays addressed to the email and only a verified owner claims it.
 */
function addresseeOf(target: InviteTarget): ShareAddressee {
	if (target.kind === "email") return { email: target.email };
	if (target.email === null || target.account.emailVerified) {
		return { userId: target.account.sub };
	}
	return { email: target.email };
}

let shareLogger: Logger = createLogger("silent");

/** Installed by `main.ts` with the app logger; silent until then. */
export function configureShareLogger(logger: Logger): void {
	shareLogger = logger;
}

/**
 * Links the environment shared with a collection to it. The roles are
 * already granted, so a failed write only loses that hint: logged, and
 * the share still succeeds.
 */
async function rememberIncluded(
	element: ElementRecord,
	included: ElementRecord,
): Promise<void> {
	try {
		await rememberSharedEnvironment(element, included);
	} catch (error) {
		shareLogger.warn(
			{ err: error, collectionId: element.id, environmentId: included.id },
			"Could not link the environment shared with a collection",
		);
	}
}

export interface ShareInput {
	readonly usernameOrEmail: string;
	readonly role: ElementRole;
	readonly includeEnvironmentId?: string;
}

/**
 * Shares the element (and the environment included with a collection)
 * with the person `usernameOrEmail` names. The caller manages roles on
 * both; neither may sit in a personal workspace. A matching account is
 * notified (in-app, Web Push, Telegram as it chose); an email without an
 * account gets a share its IdP-verified owner claims on first use.
 */
export async function shareElement(
	sub: string,
	element: ElementRecord,
	input: ShareInput,
): Promise<void> {
	const elements = [element];
	if (input.includeEnvironmentId !== undefined) {
		if (element.type !== "collection") {
			throw new OperationError(
				400,
				"VALIDATION_ERROR",
				"Only a collection can include an environment",
			);
		}
		const included = await requireElement(
			sub,
			"environment",
			input.includeEnvironmentId,
			"manageRoles",
		);
		elements.push(included.element);
	}
	for (const shared of elements) await assertShareable(shared);
	await takeInviteLookupSlot(sub);
	const target = await resolveInviteTarget(input.usernameOrEmail);
	if (!target) {
		throw new OperationError(
			404,
			"INVITEE_NOT_FOUND",
			"No account has this username; share by email instead",
		);
	}
	if (target.kind === "account" && target.account.sub === sub) {
		throw new OperationError(
			400,
			"CANNOT_SHARE_SELF",
			"You cannot share an element with yourself",
		);
	}
	const addressee = addresseeOf(target);
	for (const shared of elements) {
		await grantElementRole(shared, addressee, input.role, sub);
	}
	// Once granted: the included environment becomes the collection's
	// related one (same workspace only) until an Editor links another.
	const included = elements[1];
	if (included) await rememberIncluded(element, included);
	if (!("userId" in addressee)) return;
	const account = addressee.userId;
	const sharer = await displayNameOf(sub);
	const notifications = getNotificationService();
	for (const shared of elements) {
		notifications.notifyLater(account, {
			type: "element.shared",
			params: {
				sharer,
				elementType: shared.type,
				element: shared.name,
				role: input.role,
			},
			link: elementPath(shared),
		});
	}
}
