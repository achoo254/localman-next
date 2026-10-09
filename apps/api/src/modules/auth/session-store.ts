import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Logger } from "../../logger.js";
import { SessionModel } from "./session-model.js";
import { type TokenCipher, TokenCipherError } from "./token-cipher.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mirrors the IdP grant: 30 days idle, 90 days at most from sign-in. */
export const SESSION_IDLE_MS = 30 * DAY_MS;
export const SESSION_MAX_MS = 90 * DAY_MS;

const sessionTokens = z.object({
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1).optional(),
	idToken: z.string().min(1).optional(),
});
export type SessionTokens = z.output<typeof sessionTokens>;

export interface Session {
	/** SHA-256 of the cookie value; safe to log and to reference elsewhere. */
	readonly id: string;
	readonly sub: string;
	readonly sid?: string;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
	readonly expiresAt: Date;
}

export interface NewSession {
	readonly sub: string;
	readonly sid?: string;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
}

interface StoredSession {
	_id: string;
	sub: string;
	sid?: string | null;
	tokens: string;
	accessTokenExpiresAt: Date;
	expiresAt: Date;
	createdAt?: Date;
}

export function hashSessionToken(cookieValue: string): string {
	return createHash("sha256").update(cookieValue, "utf8").digest("hex");
}

/** Server-side sessions in MongoDB; tokens are encrypted at rest. */
/** Runs after sessions were deleted, e.g. to drop their push devices. */
export type SessionsEndedHook = (
	sessionIds: readonly string[],
) => Promise<void>;

export class SessionStore {
	constructor(
		private readonly cipher: TokenCipher,
		private readonly logger: Logger,
		private readonly onEnded?: SessionsEndedHook,
	) {}

	/** Creates a session; returns the cookie value (shown only here). */
	async create(input: NewSession): Promise<{ cookieValue: string }> {
		const cookieValue = randomBytes(32).toString("base64url");
		const id = hashSessionToken(cookieValue);
		await SessionModel.create({
			_id: id,
			sub: input.sub,
			sid: input.sid,
			tokens: this.seal(id, input.tokens),
			accessTokenExpiresAt: input.accessTokenExpiresAt,
			expiresAt: new Date(Date.now() + SESSION_IDLE_MS),
		});
		return { cookieValue };
	}

	async findByCookie(cookieValue: string): Promise<Session | null> {
		if (!/^[A-Za-z0-9_-]{43}$/.test(cookieValue)) return null;
		return this.findById(hashSessionToken(cookieValue));
	}

	async findById(id: string): Promise<Session | null> {
		const stored = await SessionModel.findOne({
			_id: id,
			expiresAt: { $gt: new Date() },
		}).lean<StoredSession>();
		return stored ? this.open(stored) : null;
	}

	/** Stores rotated tokens, slides the expiry and releases the lease. */
	async saveRefreshed(
		id: string,
		tokens: SessionTokens,
		accessTokenExpiresAt: Date,
	): Promise<Session | null> {
		const current = await SessionModel.findById(id).lean<StoredSession>();
		if (!current) return null;
		const createdAt = current.createdAt?.getTime() ?? Date.now();
		const expiresAt = new Date(
			Math.min(Date.now() + SESSION_IDLE_MS, createdAt + SESSION_MAX_MS),
		);
		const updated = await SessionModel.findOneAndUpdate(
			{ _id: id },
			{
				$set: {
					tokens: this.seal(id, tokens),
					accessTokenExpiresAt,
					expiresAt,
				},
				$unset: { refreshLockedUntil: 1 },
			},
			{ returnDocument: "after" },
		).lean<StoredSession>();
		return updated ? this.open(updated) : null;
	}

	/** Takes the refresh lease unless another holder's lease is still live. */
	async acquireRefreshLease(id: string, durationMs: number): Promise<boolean> {
		const now = new Date();
		const result = await SessionModel.updateOne(
			{
				_id: id,
				$or: [
					{ refreshLockedUntil: null },
					{ refreshLockedUntil: { $lte: now } },
				],
			},
			{ $set: { refreshLockedUntil: new Date(now.getTime() + durationMs) } },
		);
		return result.modifiedCount === 1;
	}

	async releaseRefreshLease(id: string): Promise<void> {
		await SessionModel.updateOne(
			{ _id: id },
			{ $unset: { refreshLockedUntil: 1 } },
		);
	}

	async destroyById(id: string): Promise<void> {
		await this.destroyWhere({ _id: id });
	}

	/** Back-channel logout: every session of one IdP session. */
	destroyBySid(sid: string, sub?: string): Promise<number> {
		return this.destroyWhere(sub === undefined ? { sid } : { sid, sub });
	}

	destroyBySub(sub: string): Promise<number> {
		return this.destroyWhere({ sub });
	}

	private async destroyWhere(filter: Record<string, string>): Promise<number> {
		const ids = (
			await SessionModel.find(filter).select("_id").lean<{ _id: string }[]>()
		).map((doc) => doc._id);
		if (ids.length === 0) return 0;
		const { deletedCount } = await SessionModel.deleteMany({
			_id: { $in: ids },
		});
		// Cleanup only: a failure must not undo or block the sign-out.
		await this.onEnded?.(ids).catch((error: unknown) => {
			this.logger.warn({ err: error }, "Session cleanup hook failed");
		});
		return deletedCount;
	}

	private seal(id: string, tokens: SessionTokens): string {
		return this.cipher.encrypt(JSON.stringify(tokens), id);
	}

	/** Decrypts a stored session; an unreadable one is deleted (signed out). */
	private async open(stored: StoredSession): Promise<Session | null> {
		let tokens: SessionTokens;
		try {
			tokens = sessionTokens.parse(
				JSON.parse(this.cipher.decrypt(stored.tokens, stored._id)),
			);
		} catch (error) {
			const reason =
				error instanceof TokenCipherError ? error.message : "invalid payload";
			this.logger.warn(
				{ sessionId: stored._id, reason },
				"Dropping a session whose tokens cannot be decrypted",
			);
			await this.destroyById(stored._id);
			return null;
		}
		return {
			id: stored._id,
			sub: stored.sub,
			sid: stored.sid ?? undefined,
			tokens,
			accessTokenExpiresAt: stored.accessTokenExpiresAt,
			expiresAt: stored.expiresAt,
		};
	}
}
