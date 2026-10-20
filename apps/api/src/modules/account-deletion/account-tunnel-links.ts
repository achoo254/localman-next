import { TunnelLinkModel } from "../tunelo/tunelo-link-model.js";
import { deleteTunnelLink } from "../tunelo/tunnel-link-service.js";
import { accountDeletionLog } from "./account-deletion-log.js";
import type { ErasedCount } from "./account-own-rows.js";

/**
 * Revokes every machine linked with `tunelo link` at Tunelo (the same
 * path as "Revoke" in Settings), then deletes all the account's link
 * rows. Revoking is best effort: Tunelo down, or not configured on this
 * server, never keeps a row or stops the deletion; the failure is logged
 * and the link token, sealed at rest, is deleted with the row.
 */
export async function revokeTunnelLinks(sub: string): Promise<ErasedCount> {
	const rows = await TunnelLinkModel.find({ userSub: sub }, { _id: 1 }).lean<
		{ _id: unknown }[]
	>();
	for (const row of rows) {
		try {
			await deleteTunnelLink(sub, String(row._id));
		} catch (error) {
			accountDeletionLog().warn(
				{ err: error, linkId: String(row._id) },
				"Tunelo link not revoked during account deletion",
			);
		}
	}
	// Rows a failed revoke left behind, and pairings started meanwhile.
	await TunnelLinkModel.deleteMany({ userSub: sub });
	return { collection: "tunelo_links", count: rows.length };
}
