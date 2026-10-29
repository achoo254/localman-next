import { createHash, randomBytes } from "node:crypto";
import type pino from "pino";
import type { TokenCipher } from "./token-cipher.js";
import { type StoredWebSession, WebSessionModel } from "./web-session-model.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** No session outlives this from its sign-in (the IdP's grant cap). */
export const SESSION_MAX_MS = 90 * DAY_MS;
const COOKIE_VALUE = /^[A-Za-z0-9_-]{43}$/;

/** What userinfo said at sign-in, shown in the account menu. */
export interface WebProfile {
	readonly username: string | null;
	readonly name: string | null;
	readonly email: string | null;
	/** IdP picture URL (Google, GitHub); the menu shows only `https:` ones. */
	readonly picture: string | null;
}

/** A session from before email and picture were kept has neither. */
export const EMPTY_PROFILE: WebProfile = {
	username: null,
	name: null,
	email: null,
	picture: null,
};

export interface WebSession {
	/** SHA-256 of the cookie value; safe to log. */
	readonly id: string;
	readonly sub: string;
	readonly sid: string | null;
	readonly profile: WebProfile;
	readonly refreshToken: string | null;
	readonly idToken: string | null;
	readonly accessExp: Date;
	readonly loginAt: Date;
	readonly expiresAt: Date;
}

/** Tokens from a code exchange or a refresh, as the store keeps them. */
export interface SessionTokens {
	readonly refreshToken: string | null;
	readonly idToken: string | null;
	readonly accessExp: Date;
	/** When the refresh token (the grant) expires at the IdP. */
	readonly refreshExp: Date;
}

export function hashSessionToken(cookieValue: string): string {
	return createHash("sha256").update(cookieValue, "utf8").digest("hex");
}

/** `min(loginAt + 90 days, refresh expiry)`: the session never outlives its grant. */
export function sessionExpiry(loginAt: Date, refreshExp: Date): Date {
	return new Date(
		Math.min(loginAt.getTime() + SESSION_MAX_MS, refreshExp.getTime()),
	);
}

/** Web console sessions in Tunelo's MongoDB; tokens are encrypted at rest. */
export class WebSessionStore {
	constructor(
		private readonly cipher: TokenCipher,
		private readonly logger: pino.Logger,
	) {}

	/** Creates a session; the cookie value is returned only here. */
	async create(input: {
		sub: string;
		sid: string | null;
		profile: WebProfile;
		tokens: SessionTokens;
		now?: Date;
	}): Promise<{ cookieValue: string; session: WebSession }> {
		const cookieValue = randomBytes(32).toString("base64url");
		const id = hashSessionToken(cookieValue);
		const loginAt = input.now ?? new Date();
		const stored: StoredWebSession = {
			_id: id,
			sub: input.sub,
			sid: input.sid,
			profile: input.profile,
			...this.sealTokens(id, input.tokens),
			accessExp: input.tokens.accessExp,
			loginAt,
			expiresAt: sessionExpiry(loginAt, input.tokens.refreshExp),
		};
		await WebSessionModel.create(stored);
		return { cookieValue, session: this.toSession(stored, input.tokens) };
	}

	async findByCookie(cookieValue: string): Promise<WebSession | null> {
		if (!COOKIE_VALUE.test(cookieValue)) return null;
		return this.findById(hashSessionToken(cookieValue));
	}

	async findById(id: string): Promise<WebSession | null> {
		const stored = await WebSessionModel.findOne({
			_id: id,
			expiresAt: { $gt: new Date() },
		}).lean<StoredWebSession>();
		return stored ? this.open(stored) : null;
	}

	/** Stores rotated tokens and slides the expiry (never past the cap). */
	async saveRefreshed(
		session: WebSession,
		tokens: SessionTokens,
	): Promise<WebSession | null> {
		const sealed = this.sealTokens(session.id, tokens);
		const updated = await WebSessionModel.findOneAndUpdate(
			{ _id: session.id },
			{
				$set: {
					...sealed,
					accessExp: tokens.accessExp,
					expiresAt: sessionExpiry(session.loginAt, tokens.refreshExp),
				},
			},
			{ returnDocument: "after" },
		).lean<StoredWebSession>();
		return updated ? this.open(updated) : null;
	}

	async deleteById(id: string): Promise<void> {
		await WebSessionModel.deleteOne({ _id: id });
	}

	/** Back-channel logout: every session of one IdP session (and account). */
	async deleteBySid(sid: string, sub: string | null): Promise<number> {
		const filter = sub === null ? { sid } : { sid, sub };
		const { deletedCount } = await WebSessionModel.deleteMany(filter);
		return deletedCount;
	}

	private sealTokens(
		id: string,
		tokens: SessionTokens,
	): Pick<StoredWebSession, "refreshEnc" | "idTokenEnc"> {
		return {
			refreshEnc: tokens.refreshToken
				? this.cipher.seal(tokens.refreshToken, `refresh:${id}`)
				: null,
			idTokenEnc: tokens.idToken
				? this.cipher.seal(tokens.idToken, `id_token:${id}`)
				: null,
		};
	}

	/** Decrypts a stored session; an unreadable one is dropped (signed out). */
	private async open(stored: StoredWebSession): Promise<WebSession | null> {
		const refreshToken = stored.refreshEnc
			? this.cipher.open(stored.refreshEnc, `refresh:${stored._id}`)
			: null;
		const idToken = stored.idTokenEnc
			? this.cipher.open(stored.idTokenEnc, `id_token:${stored._id}`)
			: null;
		if (
			(stored.refreshEnc && refreshToken === null) ||
			(stored.idTokenEnc && idToken === null)
		) {
			this.logger.warn(
				{ sessionId: stored._id },
				"Dropping a web session whose tokens cannot be decrypted",
			);
			await this.deleteById(stored._id);
			return null;
		}
		return this.toSession(stored, { refreshToken, idToken });
	}

	private toSession(
		stored: StoredWebSession,
		tokens: Pick<SessionTokens, "refreshToken" | "idToken">,
	): WebSession {
		return {
			id: stored._id,
			sub: stored.sub,
			sid: stored.sid ?? null,
			profile: {
				username: stored.profile?.username ?? null,
				name: stored.profile?.name ?? null,
				email: stored.profile?.email ?? null,
				picture: stored.profile?.picture ?? null,
			},
			refreshToken: tokens.refreshToken,
			idToken: tokens.idToken,
			accessExp: stored.accessExp,
			loginAt: stored.loginAt,
			expiresAt: stored.expiresAt,
		};
	}
}
