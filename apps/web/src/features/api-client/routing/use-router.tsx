/**
 * Builds the API client's router for the page: one sender for the page's
 * life (scripts in a worker, the account's settings, this browser's CORS
 * cache, and with `tuneloAccounts` the user's own Tunelo tunnels), the
 * modals it asks through (consent, which tunnel), and the request of a
 * new tab with the account's default route.
 */
import {
	type ApiRequestDraft,
	DEFAULT_REQUEST_SETTINGS,
	createRequestDraft,
} from "@localman/shared/api-client";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useFeatures } from "../../../config/features";
import { createScriptHost } from "../../../platform/script-host";
import { browserTunnelChoices } from "../tunelo/auto-tunnel";
import { ChooseTunnelModal } from "../tunelo/choose-tunnel-modal";
import { readLocalTunnels } from "../tunelo/local-tunnels-query";
import type { LocalTunnel } from "../tunelo/tunelo-accounts-api";
import { createLazyScriptRunner } from "../workbench/script-steps";
import type { RequestSender } from "../workbench/send-types";
import { type ClientSettings, clientSettingsApi } from "./client-settings-api";
import { browserCorsCache } from "./cors-cache";
import type {
	AutoTunnels,
	RoutingSnapshot,
	SecretAsk,
	TunnelPick,
} from "./route-types";
import { createRoutedSender } from "./routed-sender";
import { type ConsentAnswer, SecretConsentModal } from "./secret-consent-modal";
import { useAskQueue } from "./use-ask-queue";
import {
	readClientSettings,
	useClientSettings,
	useSettingsChange,
} from "./use-client-settings";

export interface Router {
	sender: RequestSender;
	newDraft: () => ApiRequestDraft;
	/** The router's modals; render them once inside the page. */
	element: ReactNode;
}

export function toSnapshot(settings: ClientSettings): RoutingSnapshot {
	return {
		pinnedHosts: new Set(settings.routingHosts),
		secretHosts: new Set(settings.secretProxyHosts),
		tunnels: new Map(
			settings.tunnelMappings
				.filter((mapping) => mapping.enabled)
				.map((mapping) => [mapping.key, mapping.url]),
		),
	};
}

function autoTunnels(
	queryClient: QueryClient,
	choose: AutoTunnels["choose"],
): AutoTunnels {
	return {
		list: (port, refresh) => readLocalTunnels(queryClient, port, refresh),
		choose,
		choices: browserTunnelChoices(),
	};
}

export function useRouter(): Router {
	const queryClient = useQueryClient();
	const { tuneloAccounts } = useFeatures();
	const { settings } = useClientSettings();
	const latest = useRef(settings);
	latest.current = settings;
	const allowSecrets = useSettingsChange(clientSettingsApi.allowSecrets);
	const consent = useAskQueue<SecretAsk, boolean>(false);
	const pick = useAskQueue<TunnelPick, LocalTunnel | null>(null);

	const [sender] = useState(() =>
		createRoutedSender({
			scripts: createScriptHost({ fallback: createLazyScriptRunner }),
			snapshot: async () => toSnapshot(await readClientSettings(queryClient)),
			corsCache: browserCorsCache(),
			confirmSecrets: consent.ask,
			...(tuneloAccounts
				? { autoTunnels: autoTunnels(queryClient, pick.ask) }
				: {}),
		}),
	);

	const newDraft = useCallback(
		() =>
			createRequestDraft({
				settings: {
					...DEFAULT_REQUEST_SETTINGS,
					route: latest.current.defaultRoute,
					sendClientIp: latest.current.sendClientIp,
				},
			}),
		[],
	);

	const onAnswer = ({ send, remember }: ConsentAnswer) => {
		const ask = consent.current;
		if (!ask) return;
		if (send && remember) allowSecrets.mutate(ask.host);
		consent.answer(send);
	};

	return {
		sender,
		newDraft,
		element: (
			<>
				<SecretConsentModal ask={consent.current} onAnswer={onAnswer} />
				{tuneloAccounts ? (
					<ChooseTunnelModal pick={pick.current} onAnswer={pick.answer} />
				) : null}
			</>
		),
	};
}
