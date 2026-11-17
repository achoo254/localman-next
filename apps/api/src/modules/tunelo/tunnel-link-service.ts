import { OperationError } from "@localman/operations";
import { isValidObjectId } from "mongoose";
import { TuneloApiError } from "./tunelo-api.js";
import {
	LIVE_LINK,
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
	const links = await TunnelLinkModel.find({ userSub, ...LIVE_LINK })
		.sort({ createdAt: 1 })
		.lean<StoredTunnelLink[]>();
	return { links: links.map(linkView) };
}

/**
 * The user's own link row, `null` for anything else. Any row of the user:
 * revoking one the lists leave out still revokes its token at Tunelo.
 */
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

/**
 * Revokes a linked machine's token at Tunelo (best effort, unless already
 * dead), then forgets the row. Answers the remaining links. A row left
 * `pending` by the retired code pairing has no token and is only dropped.
 */
export async function deleteTunnelLink(
	userSub: string,
	id: string,
): Promise<{ links: TunnelLinkView[] }> {
	const row = await ownLink(userSub, id);
	if (!row) throw notFound();
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
	await TunnelLinkModel.deleteOne({ _id: id, userSub });
	tuneloRuntime().cache.drop(userSub);
	return listTunnelLinks(userSub);
}
