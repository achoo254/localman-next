import { setTimeout as delay } from "node:timers/promises";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { normalizeTunnelUrl } from "../api-client/client-settings-input.js";
import { machineTunnelsOf } from "./machine-targets.js";
import { TuneloApiError, type TuneloTunnel } from "./tunelo-api.js";
import { TunnelLinkModel, linkTokenSlot } from "./tunelo-link-model.js";
import { type TuneloRuntime, tuneloRuntime } from "./tunelo-runtime.js";
import type {
	LocalTunnel,
	LocalTunnelList,
	TunnelSourceFailure,
} from "./tunelo-view.js";
import {
	TUNNEL_LIST_TTL_MS,
	TUNNEL_REFRESH_MIN_MS,
} from "./tunnel-list-cache.js";

const MAX_DEVICE_NAME = 100;
/** A machine tunnel (`m-<hash>`): the `tunelo` process's own, never a target. */
const MACHINE_TUNNEL = /^https:\/\/m-[0-9a-f]{30}\./;

function isMachineTunnel(url: string): boolean {
	return MACHINE_TUNNEL.test(url);
}
const TCP_URL = /^tcp:\/\/[a-z0-9.-]{1,253}:\d{1,5}$/i;

/** A source Tunelo lists tunnels for (machines are added apart). */
interface Source {
	source: "account" | "link";
	linkId: string | null;
}

/**
 * A row of Tunelo's list as Localman serves it. An HTTP tunnel must be a
 * bare `https://<label>.<domain>` on the tenant's tunnel domains, like a
 * tunnel URL the user pastes: the browser sends credentials there.
 */
function toLocalTunnel(
	item: TuneloTunnel,
	source: Source,
	domains: readonly string[],
): LocalTunnel | null {
	const url =
		item.protocol === "http"
			? normalizeTunnelUrl(item.url, domains)
			: TCP_URL.test(item.url)
				? item.url.toLowerCase()
				: null;
	if (url === null || isMachineTunnel(url)) return null;
	return {
		...source,
		protocol: item.protocol,
		url,
		localPort: item.localPort,
		publicPort: item.publicPort ?? null,
		deviceName: item.deviceName.trim().slice(0, MAX_DEVICE_NAME),
		connectedAt: item.connectedAt,
		basicAuth: item.basicAuth,
	};
}

function failureOf(error: unknown, source: Source): TunnelSourceFailure {
	const unauthorized = error instanceof TuneloApiError && error.unauthorized;
	return { ...source, reason: unauthorized ? "unauthorized" : "unavailable" };
}

interface SourceResult {
	readonly tunnels: LocalTunnel[];
	readonly failure: TunnelSourceFailure | null;
}

async function readSource(
	runtime: TuneloRuntime,
	source: Source,
	token: () => Promise<string>,
): Promise<SourceResult> {
	try {
		const items = await runtime.api().listTunnels(await token());
		const domains = tenantSettings().tunnelDomains;
		const tunnels = items
			.map((item) => toLocalTunnel(item, source, domains))
			.filter((item): item is LocalTunnel => item !== null);
		return { tunnels, failure: null };
	} catch (error) {
		// No token in the log: the error names the call and status only.
		runtime.deps.logger.warn(
			{
				source: source.source,
				linkId: source.linkId,
				status: error instanceof TuneloApiError ? error.status : null,
				err: error instanceof TuneloApiError ? undefined : error,
			},
			"Tunelo tunnel list failed",
		);
		return { tunnels: [], failure: failureOf(error, source) };
	}
}

/**
 * What a link's read teaches: the machine's name for the linked machines
 * list, or that Tunelo refuses its token (revoked on the machine), which
 * marks the link dead.
 */
async function learnFromLink(
	rowId: string,
	known: string | null | undefined,
	result: SourceResult,
): Promise<void> {
	if (result.failure?.reason === "unauthorized") {
		await TunnelLinkModel.updateOne({ _id: rowId }, { deadAt: new Date() });
		return;
	}
	const name = result.tunnels[0]?.deviceName;
	if (name && name !== known) {
		await TunnelLinkModel.updateOne({ _id: rowId }, { deviceName: name });
	}
}

/**
 * Every live tunnel of the user: their Tunelo account (session exchanged
 * for a `tunnels:read` token; only with a browser session, `null` skips it)
 * and each linked machine (its link token), in parallel. A source that
 * fails is reported in `failures`, never fatal.
 */
export async function fetchAll(
	runtime: TuneloRuntime,
	userSub: string,
	sessionId: string | null,
): Promise<LocalTunnelList> {
	const { cipher } = runtime.deps;
	// Links Tunelo refused before are not called again (`deadAt`).
	const links = await TunnelLinkModel.find({
		userSub,
		status: "linked",
		deadAt: null,
		// An own machine's row exists a moment before its token does.
		tokenSealed: { $type: "string" },
	})
		.select({ tokenSealed: 1, linkId: 1, deviceName: 1 })
		.lean();
	const account =
		sessionId === null
			? null
			: readSource(runtime, { source: "account", linkId: null }, () =>
					runtime.deps.accountTokens.accessTokenFor(sessionId),
				);
	const linked = links.map(async (link) => {
		const id = String(link._id);
		const result = await readSource(
			runtime,
			{ source: "link", linkId: id },
			async () =>
				cipher.decrypt(link.tokenSealed ?? "", linkTokenSlot(userSub, id)),
		);
		await learnFromLink(id, link.deviceName, result);
		return result;
	});
	const results = await Promise.all(account ? [account, ...linked] : linked);
	const seen = new Set<string>();
	const tunnels: LocalTunnel[] = [];
	for (const tunnel of results.flatMap((result) => result.tunnels)) {
		if (seen.has(tunnel.url)) continue;
		seen.add(tunnel.url);
		tunnels.push(tunnel);
	}
	const failures = results
		.map((result) => result.failure)
		.filter((failure): failure is TunnelSourceFailure => failure !== null);
	return { tunnels, failures };
}

/**
 * The user's tunnels, those of `port` only when given. The merged list is
 * cached 10 seconds per user; `refresh` ("Check again") reads it anew.
 * A refresh of a list younger than 2 seconds waits until it is that old,
 * so clicks cannot fan out to Tunelo faster, yet every click gets a fresh
 * list.
 */
export async function listLocalTunnels(
	userSub: string,
	sessionId: string,
	options: { port?: number; refresh?: boolean },
): Promise<LocalTunnelList> {
	const runtime = tuneloRuntime();
	const refreshMin = runtime.deps.refreshMinMs ?? TUNNEL_REFRESH_MIN_MS;
	const load = (): Promise<LocalTunnelList> =>
		runtime.cache.load(userSub, () => fetchAll(runtime, userSub, sessionId));
	let list: LocalTunnelList;
	if (options.refresh) {
		const age = runtime.cache.age(userSub);
		if (age !== null && age < refreshMin) await delay(refreshMin - age);
		list = await load();
	} else {
		list = runtime.cache.get(userSub, TUNNEL_LIST_TTL_MS) ?? (await load());
	}
	const { port } = options;
	if (port === undefined) return list;
	const tunnels = list.tunnels.filter((t) => t.localPort === port);
	return {
		...list,
		tunnels: [...tunnels, ...(await machineTunnelsOf(userSub, port))],
	};
}
