import { OperationError } from "@localman/operations";
import { brand } from "@localman/shared/brand";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { TuneloApiError } from "./tunelo-api.js";
import {
	MAX_TUNNEL_LINKS,
	type StoredTunnelLink,
	TunnelLinkModel,
	linkTokenSlot,
} from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";
import type { TunnelLinkView } from "./tunelo-view.js";
import {
	linkView,
	notFound,
	ownLink,
	revokeQuietly,
} from "./tunnel-link-service.js";

/** Name Tunelo shows on the machine (`tunelo link` asks to approve it). */
const CLIENT_NAME = brand.appName;
/**
 * Pairings of one user waiting at once: Tunelo opens few per client IP
 * (this server's, shared by every user), so one user must not take them all.
 */
const MAX_PENDING_LINKS = 3;

/**
 * Tunelo could not be reached or refused: 502, nothing stored. Tunelo
 * limits pairings per client IP, and every pairing comes from this server:
 * its 429 stays a 429.
 */
function tuneloFailed(error: unknown): OperationError {
	if (!(error instanceof TuneloApiError)) throw error;
	tuneloRuntime().deps.logger.warn(
		{ call: error.call, status: error.status },
		"Tunelo link call failed",
	);
	if (error.status === 429) {
		return new OperationError(
			429,
			"RATE_LIMITED",
			"Too many pairings, try again later",
		);
	}
	return new OperationError(502, "TUNELO_UNAVAILABLE", "Tunelo did not answer");
}

/** Opens a pairing at Tunelo: the code the user types in `tunelo link`. */
export async function startTunnelLink(
	userSub: string,
): Promise<{ id: string; code: string; expiresAt: string }> {
	const pending = await TunnelLinkModel.countDocuments({
		userSub,
		status: "pending",
		pendingUntil: { $gt: new Date() },
	});
	if (pending >= MAX_PENDING_LINKS) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			`At most ${MAX_PENDING_LINKS} pairings wait at once`,
		);
	}
	if ((await TunnelLinkModel.countDocuments({ userSub })) >= MAX_TUNNEL_LINKS) {
		throw new OperationError(
			409,
			"TUNNEL_LINK_LIMIT_REACHED",
			`At most ${MAX_TUNNEL_LINKS} linked machines`,
			{ max: MAX_TUNNEL_LINKS },
		);
	}
	// Per user over time, cancelled pairings included: Tunelo's budget is
	// per IP, and this server's IP is shared by every user.
	await takeOperationSlot("tuneloLink", userSub, null);
	const opened = await tuneloRuntime()
		.api()
		.initLink(CLIENT_NAME)
		.catch((error: unknown) => {
			throw tuneloFailed(error);
		});
	const row = await TunnelLinkModel.create({
		userSub,
		status: "pending",
		requestId: opened.requestId,
		pendingUntil: new Date(opened.expiresAt),
	});
	return {
		id: String(row._id),
		code: opened.code,
		expiresAt: opened.expiresAt,
	};
}

type PollResult =
	| { status: "pending" }
	| { status: "expired" }
	| { status: "linked"; link: TunnelLinkView };

/**
 * Asks Tunelo whether the machine approved the user's own pairing. On
 * approval the link token is sealed into the row, once: Tunelo hands it
 * out to a single poll. A poll that lost that race reads the row again.
 */
export async function pollTunnelLink(
	userSub: string,
	id: string,
): Promise<PollResult> {
	const row = await ownLink(userSub, id);
	if (!row) throw notFound();
	if (row.status === "linked") return { status: "linked", link: linkView(row) };
	if (!row.requestId) throw notFound();
	const runtime = tuneloRuntime();
	const answer = await runtime
		.api()
		.pollLink(row.requestId)
		.catch((error: unknown) => {
			throw tuneloFailed(error);
		});
	if (answer.status === "pending") return { status: "pending" };
	if (answer.status === "expired") {
		const now = await ownLink(userSub, id);
		if (now?.status === "linked")
			return { status: "linked", link: linkView(now) };
		// Another poll claimed the token and is storing it.
		if (now?.pendingUntil && now.pendingUntil > new Date()) {
			return { status: "pending" };
		}
		await TunnelLinkModel.deleteOne({ _id: id, userSub, status: "pending" });
		return { status: "expired" };
	}
	const sealed = runtime.deps.cipher.encrypt(
		answer.token,
		linkTokenSlot(userSub, id),
	);
	const linked = await TunnelLinkModel.findOneAndUpdate(
		{ _id: id, userSub, status: "pending" },
		{
			$set: {
				status: "linked",
				tokenSealed: sealed,
				linkId: answer.linkId,
				linkedAt: new Date(),
			},
			$unset: { requestId: 1, pendingUntil: 1 },
		},
		{ returnDocument: "after" },
	).lean<StoredTunnelLink>();
	if (!linked) {
		// The pairing was cancelled meanwhile: the fresh token goes back.
		await revokeQuietly(answer.token);
		return { status: "expired" };
	}
	runtime.cache.drop(userSub);
	return { status: "linked", link: linkView(linked) };
}
