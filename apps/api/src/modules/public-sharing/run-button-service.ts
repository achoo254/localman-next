import { OperationError } from "@localman/operations";
import type { RunButtonVisibility } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { requireEnvironment } from "../environments/environment-access.js";
import { newCapabilityId } from "./capability-id.js";
import { RunButtonModel, type StoredRunButton } from "./run-button-model.js";
import { BUTTON_ID_BYTES } from "./run-button-source.js";

/** Buttons one collection may have. */
export const RUN_BUTTONS_PER_COLLECTION_MAX = 20;

export interface RunButtonView {
	id: string;
	visibility: RunButtonVisibility;
	environmentId: string | null;
	/** The page the button opens: `/run/<id>`. */
	url: string;
	/** The badge image to embed. */
	badgeUrl: string;
	createdBy: string;
	createdAt: string;
}

export function toButtonView(button: StoredRunButton): RunButtonView {
	const origin = tenantSettings().publicUrl;
	return {
		id: button._id.toHexString(),
		visibility: button.visibility,
		environmentId: button.environmentId?.toHexString() ?? null,
		url: `${origin}/run/${button.buttonId}`,
		badgeUrl: `${origin}/run-button.svg`,
		createdBy: button.createdBy,
		createdAt: button.createdAt.toISOString(),
	};
}

/** The environment a button may carry: same workspace, shareable by `sub`. */
export async function requireButtonEnvironment(
	sub: string,
	environmentId: string,
	workspaceId: Types.ObjectId,
): Promise<Types.ObjectId> {
	const access = await requireEnvironment(sub, environmentId, "shareVariables");
	if (!access.element.workspaceId.equals(workspaceId)) {
		throw new OperationError(
			409,
			"ENVIRONMENT_NOT_IN_WORKSPACE",
			"The environment must be in the collection's workspace",
		);
	}
	return access.environmentId;
}

export async function createRunButton(input: {
	collectionId: Types.ObjectId;
	environmentId: Types.ObjectId | null;
	visibility: RunButtonVisibility;
	sub: string;
}): Promise<StoredRunButton> {
	const count = await RunButtonModel.countDocuments({
		collectionId: input.collectionId,
	});
	if (count >= RUN_BUTTONS_PER_COLLECTION_MAX) {
		throw new OperationError(
			409,
			"RUN_BUTTON_LIMIT_REACHED",
			`A collection has at most ${RUN_BUTTONS_PER_COLLECTION_MAX} Run buttons`,
			{ max: RUN_BUTTONS_PER_COLLECTION_MAX },
		);
	}
	const created = await RunButtonModel.create({
		buttonId: newCapabilityId(BUTTON_ID_BYTES),
		collectionId: input.collectionId,
		environmentId: input.environmentId,
		visibility: input.visibility,
		createdBy: input.sub,
	});
	return created.toObject<StoredRunButton>();
}

export function listRunButtons(
	collectionId: Types.ObjectId,
): Promise<StoredRunButton[]> {
	return RunButtonModel.find({ collectionId })
		.sort({ createdAt: -1 })
		.lean<StoredRunButton[]>();
}

export function findRunButton(
	collectionId: Types.ObjectId,
	id: Types.ObjectId,
): Promise<StoredRunButton | null> {
	return RunButtonModel.findOne({
		_id: id,
		collectionId,
	}).lean<StoredRunButton>();
}
