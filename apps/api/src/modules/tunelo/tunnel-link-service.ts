import { OperationError } from "@localman/operations";
import { isValidObjectId } from "mongoose";
import { TuneloApiError } from "./tunelo-api.js";
import {
	type StoredTunnelLink,
	TunnelLinkModel,
	linkTokenSlot,
} from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";
import type { TunnelLinkView } from "./tunelo-view.js";

export function notFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Tunnel link not found");
}

export function linkView(link: StoredTunnelLink): TunnelLinkView {
	return {
		id: String(link._id),
		deviceName: link.deviceName ?? null,
		linkedAt: (link.linkedAt ?? link.createdAt ?? new Date(0)).toISOString(),
		revoked: Boolean(link.deadAt),
	};
}

/** The user's linked machines, oldest first. */
export async function listTunnelLinks(
	userSub: string,
): Promise<{ links: TunnelLinkView[] }> {
	const links = await TunnelLinkModel.find({ userSub, status: "linked" })
		.sort({ createdAt: 1 })
		.lean<StoredTunnelLink[]>();
	return { links: links.map(linkView) };
}

/** The user's own link or pairing, `null` for anything else. */
export async function ownLink(
	userSub: string,
	id: string,
): Promise<StoredTunnelLink | null> {
	if (!isValidObjectId(id)) return null;
	return TunnelLinkModel.findOne({ _id: id, userSub }).lean<StoredTunnelLink>();
}

/** Tunelo forgets a link token; a failure does not keep the row. */
export async function revokeQuietly(token: string): Promise<void> {
	try {
		await tuneloRuntime().api().revokeLink(token);
	} catch (error) {
		if (!(error instanceof TuneloApiError)) throw error;
		tuneloRuntime().deps.logger.warn(
			{ status: error.status },
			"Tunelo link revoke failed",
		);
	}
}

/** Revokes a linked row's token at Tunelo (unless already dead), then drops it. */
async function revokeAndDelete(
	userSub: string,
	row: StoredTunnelLink,
): Promise<void> {
	const id = String(row._id);
	if (row.tokenSealed && !row.deadAt) {
		const { cipher, logger } = tuneloRuntime().deps;
		let token: string | null = null;
		try {
			token = cipher.decrypt(row.tokenSealed, linkTokenSlot(userSub, id));
		} catch {
			logger.warn({ linkId: id }, "Tunelo link token unreadable");
		}
		if (token !== null) await revokeQuietly(token);
	}
	await TunnelLinkModel.deleteOne({ _id: id, userSub, status: "linked" });
}

/**
 * Revokes a linked machine (Tunelo first, best effort) or cancels a
 * pending pairing, then forgets it. Answers the remaining links. A
 * pairing a concurrent poll just linked is revoked, never dropped alone.
 */
export async function deleteTunnelLink(
	userSub: string,
	id: string,
): Promise<{ links: TunnelLinkView[] }> {
	const row = await ownLink(userSub, id);
	if (!row) throw notFound();
	if (row.status === "linked") {
		await revokeAndDelete(userSub, row);
	} else {
		const cancelled = await TunnelLinkModel.deleteOne({
			_id: id,
			userSub,
			status: "pending",
		});
		const now =
			cancelled.deletedCount === 0 ? await ownLink(userSub, id) : null;
		if (now?.status === "linked") await revokeAndDelete(userSub, now);
	}
	tuneloRuntime().cache.drop(userSub);
	return listTunnelLinks(userSub);
}
