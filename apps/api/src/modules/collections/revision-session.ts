import { CHANGELOG_SESSION_WINDOW_MS } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { CollectionRevisionModel } from "./collection-revision-model.js";

/** The first revision of a changelog session. */
export interface SessionStart {
	readonly seq: number;
	readonly at: Date;
}

interface Latest {
	readonly authorId: string;
	readonly sessionStartSeq?: number | null;
	readonly sessionStartAt?: Date | null;
}

/**
 * The session a revision `authorId` writes at `at` joins: that of the
 * newest revision when the same author wrote it and the session started
 * at most `CHANGELOG_SESSION_WINDOW_MS` before; `null` starts a new one.
 * Read in the write's transaction (under the workspace lock), so the
 * newest revision cannot change meanwhile. A newest revision written
 * before sessions were stored starts nothing to join.
 */
export async function sessionToJoin(
	collectionId: Types.ObjectId,
	authorId: string,
	at: Date,
	session: ClientSession,
): Promise<SessionStart | null> {
	const latest = await CollectionRevisionModel.findOne(
		{ collectionId },
		{ authorId: 1, sessionStartSeq: 1, sessionStartAt: 1 },
	)
		.session(session)
		.sort({ seq: -1 })
		.lean<Latest>();
	const seq = latest?.sessionStartSeq;
	const startedAt = latest?.sessionStartAt;
	if (!latest || latest.authorId !== authorId || !seq || !startedAt) {
		return null;
	}
	const elapsed = at.getTime() - startedAt.getTime();
	return elapsed <= CHANGELOG_SESSION_WINDOW_MS ? { seq, at: startedAt } : null;
}
