import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { normalizeTunnelUrl } from "../api-client/client-settings-input.js";
import { FORWARD_PATH } from "./machine-forward-contract.js";
import { TuneloApiError, type TuneloSelfLinkInfo } from "./tunelo-api.js";
import {
	MAX_TUNNEL_LINKS,
	type StoredTunnelLink,
	TunnelLinkModel,
	linkTokenSlot,
} from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";
import type { TunnelLinkView } from "./tunelo-view.js";
import { linkView, revokeQuietly } from "./tunnel-link-service.js";

export interface SelfLinkInput {
	/** Link token Tunelo minted for the machine (`POST /api/links/self`). */
	readonly token: string;
	/** The machine's id and name, as the process reports them. */
	readonly machineId: string;
	readonly machineName: string;
}

function tuneloRefused(error: unknown): OperationError {
	if (!(error instanceof TuneloApiError)) throw error;
	tuneloRuntime().deps.logger.warn(
		{ call: error.call, status: error.status },
		"Tunelo self link check failed",
	);
	// 404: a pairing token (`tunelo link`) has no machine of an account.
	if (error.unauthorized || error.status === 404) {
		return new OperationError(
			400,
			"INVALID_LINK_TOKEN",
			"Tunelo does not know this link token",
		);
	}
	return new OperationError(502, "TUNELO_UNAVAILABLE", "Tunelo did not answer");
}

/**
 * `https://m-<hash>.<tunnel domain>/.tunelo/forward` as Tunelo answered
 * it, or `null`: Localman sends the link token there, so it must be a
 * tunnel of this server's domains with exactly that path.
 */
export function checkedForwardUrl(raw: string): string | null {
	if (!URL.canParse(raw)) return null;
	const url = new URL(raw);
	const origin = normalizeTunnelUrl(url.origin, tenantSettings().tunnelDomains);
	if (origin === null || url.pathname !== FORWARD_PATH || url.search !== "") {
		return null;
	}
	return `${origin}${FORWARD_PATH}`;
}

async function linkInfo(token: string): Promise<TuneloSelfLinkInfo> {
	return tuneloRuntime()
		.api()
		.selfLinkInfo(token)
		.catch((error: unknown) => {
			throw tuneloRefused(error);
		});
}

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === DUPLICATE_KEY
	);
}

/**
 * The machine's row, created or updated by its key. Two links racing to
 * create it hit the unique index; the loser updates the winner's row.
 */
async function upsertOwnMachine(
	key: { userSub: string; source: "self"; deviceId: string },
	fields: Record<string, unknown>,
): Promise<StoredTunnelLink> {
	const update = () =>
		TunnelLinkModel.findOneAndUpdate(
			key,
			{ $set: fields, $setOnInsert: { forwardEnabled: true } },
			{ upsert: true, returnDocument: "after" },
		).lean<StoredTunnelLink>();
	let row: StoredTunnelLink | null;
	try {
		row = await update();
	} catch (error) {
		if (!isDuplicateKey(error)) throw error;
		row = await update();
	}
	if (!row) throw new OperationError(500, "INTERNAL_ERROR", "Link not stored");
	return row;
}

/**
 * The `tunelo` process of `userSub`'s account links its machine. Tunelo
 * says whose machine the token is for; a token of another account is
 * refused (403), so no one links their machine into someone else's
 * Localman. The machine keeps one row: linking again replaces its token
 * (the old one is revoked) and keeps the user's forward switch.
 */
export async function linkOwnMachine(
	userSub: string,
	input: SelfLinkInput,
): Promise<TunnelLinkView> {
	const runtime = tuneloRuntime();
	const info = await linkInfo(input.token);
	if (info.ownerSub !== userSub) {
		throw new OperationError(
			403,
			"LINK_OWNER_MISMATCH",
			"This machine is linked to another account",
		);
	}
	const forwardUrl = checkedForwardUrl(info.forwardUrl);
	if (forwardUrl === null) {
		runtime.deps.logger.warn("Tunelo answered an unexpected forward URL");
		throw new OperationError(
			502,
			"TUNELO_UNAVAILABLE",
			"Tunelo did not answer",
		);
	}
	const { cipher } = runtime.deps;
	const key = { userSub, source: "self" as const, deviceId: info.deviceId };
	if (!(await TunnelLinkModel.exists(key))) {
		const count = await TunnelLinkModel.countDocuments({ userSub });
		if (count >= MAX_TUNNEL_LINKS) {
			throw new OperationError(
				409,
				"TUNNEL_LINK_LIMIT_REACHED",
				`At most ${MAX_TUNNEL_LINKS} linked machines`,
				{ max: MAX_TUNNEL_LINKS },
			);
		}
	}
	// The row first (its id seals the token), then the token.
	const row = await upsertOwnMachine(key, {
		status: "linked",
		machineId: input.machineId,
		machineName: input.machineName,
		forwardUrl,
		linkedAt: new Date(),
	});
	const id = String(row._id);
	const before = await TunnelLinkModel.findOneAndUpdate(
		{ _id: id, userSub },
		{
			$set: {
				tokenSealed: cipher.encrypt(input.token, linkTokenSlot(userSub, id)),
				linkId: info.linkId,
			},
			$unset: { deadAt: 1 },
		},
		{ returnDocument: "before" },
	).lean<StoredTunnelLink>();
	if (before?.tokenSealed && before.linkId !== info.linkId) {
		let old: string | null = null;
		try {
			old = cipher.decrypt(before.tokenSealed, linkTokenSlot(userSub, id));
		} catch {
			runtime.deps.logger.warn({ linkId: id }, "Old link token unreadable");
		}
		if (old !== null && old !== input.token) await revokeQuietly(old);
	}
	const linked = await TunnelLinkModel.findOne({
		_id: id,
		userSub,
	}).lean<StoredTunnelLink>();
	runtime.cache.drop(userSub);
	if (!linked)
		throw new OperationError(500, "INTERNAL_ERROR", "Link not stored");
	return linkView(linked);
}

/** The user turns Localman's requests to a machine's localhost on or off. */
export async function setMachineForward(
	userSub: string,
	id: string,
	enabled: boolean,
): Promise<TunnelLinkView> {
	const row = Types.ObjectId.isValid(id)
		? await TunnelLinkModel.findOneAndUpdate(
				{ _id: id, userSub, source: "self", status: "linked" },
				{ $set: { forwardEnabled: enabled } },
				{ returnDocument: "after" },
			).lean<StoredTunnelLink>()
		: null;
	if (!row) {
		throw new OperationError(404, "NOT_FOUND", "Machine not found");
	}
	tuneloRuntime().cache.drop(userSub);
	return linkView(row);
}
