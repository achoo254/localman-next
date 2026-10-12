/**
 * Builds the API client's router for the page: one sender for the page's
 * life (scripts in a worker, the account's settings, this browser's CORS
 * cache), the consent modal it asks through, and the request of a new
 * tab with the account's default route.
 */
import {
	type ApiRequestDraft,
	DEFAULT_REQUEST_SETTINGS,
	createRequestDraft,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { createScriptHost } from "../../../platform/script-host";
import { createLazyScriptRunner } from "../workbench/script-steps";
import type { RequestSender } from "../workbench/send-types";
import { type ClientSettings, clientSettingsApi } from "./client-settings-api";
import { browserCorsCache } from "./cors-cache";
import type { RoutingSnapshot, SecretAsk } from "./route-types";
import { createRoutedSender } from "./routed-sender";
import { type ConsentAnswer, SecretConsentModal } from "./secret-consent-modal";
import {
	readClientSettings,
	useClientSettings,
	useSettingsChange,
} from "./use-client-settings";

export interface Router {
	sender: RequestSender;
	newDraft: () => ApiRequestDraft;
	/** The consent modal; render it once inside the page. */
	element: ReactNode;
}

interface PendingAsk {
	ask: SecretAsk;
	resolve: (send: boolean) => void;
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

export function useRouter(): Router {
	const queryClient = useQueryClient();
	const { settings } = useClientSettings();
	const latest = useRef(settings);
	latest.current = settings;
	const allowSecrets = useSettingsChange(clientSettingsApi.allowSecrets);
	// Several tabs may ask at once: one modal, answered in order.
	const queue = useRef<PendingAsk[]>([]);
	const [current, setCurrent] = useState<PendingAsk | null>(null);

	const [sender] = useState(() =>
		createRoutedSender({
			scripts: createScriptHost({ fallback: createLazyScriptRunner }),
			snapshot: async () => toSnapshot(await readClientSettings(queryClient)),
			corsCache: browserCorsCache(),
			confirmSecrets: (ask, signal) =>
				new Promise<boolean>((resolve) => {
					const pending: PendingAsk = {
						ask,
						resolve: (send) => {
							signal.removeEventListener("abort", onAbort);
							queue.current = queue.current.filter((item) => item !== pending);
							setCurrent(queue.current[0] ?? null);
							resolve(send);
						},
					};
					const onAbort = () => pending.resolve(false);
					signal.addEventListener("abort", onAbort, { once: true });
					queue.current = [...queue.current, pending];
					setCurrent(queue.current[0] ?? null);
				}),
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
		if (!current) return;
		if (send && remember) allowSecrets.mutate(current.ask.host);
		current.resolve(send);
	};

	return {
		sender,
		newDraft,
		element: (
			<SecretConsentModal ask={current?.ask ?? null} onAnswer={onAnswer} />
		),
	};
}
