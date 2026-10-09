import { OperationError } from "@localman/operations";
import {
	type ApiRequestDraft,
	DRAFT_MAX_TABS,
} from "@localman/shared/api-client";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { DraftModel, type StoredDraft } from "./draft-model.js";
import { DRAFT_MAX_BYTES, draftBytes, draftTooLarge } from "./draft-size.js";

export interface DraftView {
	tabId: string;
	order: number;
	draft: ApiRequestDraft;
	updatedAt: string;
}

export interface SaveDraftInput {
	readonly tabId: string;
	readonly draft: ApiRequestDraft;
	/** Position in the tab bar; a new tab without one goes last. */
	readonly order?: number;
}

function toDraftView(doc: StoredDraft): DraftView {
	return {
		tabId: doc.tabId,
		order: doc.order,
		draft: doc.draft,
		updatedAt: doc.updatedAt.toISOString(),
	};
}

/** The user's open tabs in tab-bar order. */
export async function listDrafts(userSub: string): Promise<DraftView[]> {
	const docs = await DraftModel.find({ userSub })
		.sort({ order: 1, _id: 1 })
		.lean<StoredDraft[]>();
	return docs.map(toDraftView);
}

async function updateExisting(
	userSub: string,
	input: SaveDraftInput,
): Promise<DraftView | null> {
	const doc = await DraftModel.findOneAndUpdate(
		{ userSub, tabId: input.tabId },
		{
			$set: {
				draft: input.draft,
				...(input.order === undefined ? {} : { order: input.order }),
			},
		},
		{ returnDocument: "after" },
	).lean<StoredDraft>();
	return doc ? toDraftView(doc) : null;
}

function draftLimitReached(): OperationError {
	return new OperationError(
		409,
		"DRAFT_LIMIT_REACHED",
		`At most ${DRAFT_MAX_TABS} tabs with an unsaved request; close one first`,
		{ max: DRAFT_MAX_TABS },
	);
}

async function createDraft(
	userSub: string,
	input: SaveDraftInput,
): Promise<DraftView> {
	if ((await DraftModel.countDocuments({ userSub })) >= DRAFT_MAX_TABS) {
		throw draftLimitReached();
	}
	const last = await DraftModel.findOne({ userSub })
		.sort({ order: -1 })
		.select("order")
		.lean<{ order: number }>();
	const created = await DraftModel.create({
		userSub,
		tabId: input.tabId,
		order: input.order ?? (last ? last.order + 1 : 0),
		draft: input.draft,
	});
	// Concurrent new tabs may all pass the count above: undo the extra one.
	if ((await DraftModel.countDocuments({ userSub })) > DRAFT_MAX_TABS) {
		await DraftModel.deleteOne({ _id: created._id });
		throw draftLimitReached();
	}
	return toDraftView(created.toObject<StoredDraft>());
}

/**
 * Creates or replaces the draft of one tab. 413 `DRAFT_TOO_LARGE` above
 * `DRAFT_MAX_BYTES`; 409 `DRAFT_LIMIT_REACHED` for a new tab beyond
 * `DRAFT_MAX_TABS`.
 */
export async function saveDraft(
	userSub: string,
	input: SaveDraftInput,
): Promise<DraftView> {
	const bytes = draftBytes(input.draft);
	if (bytes > DRAFT_MAX_BYTES) throw draftTooLarge(bytes, DRAFT_MAX_BYTES);
	const updated = await updateExisting(userSub, input);
	if (updated) return updated;
	try {
		return await createDraft(userSub, input);
	} catch (error) {
		// The same tab was created by a concurrent save: update it instead.
		if (!isDuplicateKeyError(error)) throw error;
		const raced = await updateExisting(userSub, input);
		if (raced) return raced;
		throw error;
	}
}

/** `false` when the tab had no saved draft (closing it is still fine). */
export async function deleteDraft(
	userSub: string,
	tabId: string,
): Promise<boolean> {
	const result = await DraftModel.deleteOne({ userSub, tabId });
	return result.deletedCount > 0;
}

/** Sets each listed tab's order to its index; unknown tabs are ignored. */
export async function reorderDrafts(
	userSub: string,
	tabIds: readonly string[],
): Promise<DraftView[]> {
	if (tabIds.length > 0) {
		await DraftModel.bulkWrite(
			tabIds.map((tabId, order) => ({
				updateOne: { filter: { userSub, tabId }, update: { $set: { order } } },
			})),
		);
	}
	return listDrafts(userSub);
}
