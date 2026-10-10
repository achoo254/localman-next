import type { RouteMode } from "@localman/shared/api-client";
import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../../../components/ui/toast";
import { errorMessage } from "../../../lib/api-client";
import { optimisticHandlers } from "../../../lib/optimistic";
import {
	type ClientSettings,
	DEFAULT_CLIENT_SETTINGS,
	type TunnelMapping,
	clientSettingsApi,
} from "./client-settings-api";

export const CLIENT_SETTINGS_KEY = ["api-client", "settings"] as const;

const QUERY = {
	queryKey: CLIENT_SETTINGS_KEY,
	queryFn: clientSettingsApi.get,
	staleTime: 30_000,
} as const;

/** Cached settings, fetched when missing (the router reads them per send). */
export function readClientSettings(
	queryClient: QueryClient,
): Promise<ClientSettings> {
	return queryClient.fetchQuery(QUERY);
}

/** The account's routing settings; defaults until loaded or when unreadable. */
export function useClientSettings() {
	const query = useQuery(QUERY);
	return { ...query, settings: query.data ?? DEFAULT_CLIENT_SETTINGS };
}

/**
 * A settings write: the answer replaces the cached settings; a failure
 * shows a toast with the API's message.
 */
export function useSettingsChange<Arg>(
	write: (arg: Arg) => Promise<ClientSettings>,
) {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationFn: write,
		onSuccess: (settings) => {
			queryClient.setQueryData(CLIENT_SETTINGS_KEY, settings);
		},
		onError: (error) => {
			toast.show({ tone: "error", title: errorMessage(error) });
		},
	});
}

/**
 * A settings write shown at once (toggles, pinned hosts): `apply` edits
 * the cached settings before the request, a failure puts them back with
 * an error toast. The answer (the whole settings) replaces the cache once
 * no other optimistic write is running, so a later write's value is not
 * overwritten by an earlier answer.
 */
export function useOptimisticSettingsChange<Arg>(
	write: (arg: Arg) => Promise<ClientSettings>,
	apply: (settings: ClientSettings, arg: Arg) => ClientSettings,
) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { mutationKey, onMutate, onError } = optimisticHandlers<
		ClientSettings,
		Arg
	>(queryClient, (message) => toast.show({ tone: "error", title: message }), {
		queryKey: CLIENT_SETTINGS_KEY,
		apply,
	});
	return useMutation({
		mutationKey,
		mutationFn: write,
		onMutate,
		onError,
		onSuccess: (settings) => {
			// This write still counts as running here.
			if (queryClient.isMutating({ mutationKey }) <= 1) {
				queryClient.setQueryData(CLIENT_SETTINGS_KEY, settings);
			}
		},
	});
}

/** Edits of the cached settings that the optimistic writes apply. */
export const settingsEdits = {
	defaultRoute: (settings: ClientSettings, defaultRoute: RouteMode) => ({
		...settings,
		defaultRoute,
	}),
	pinHost: (settings: ClientSettings, host: string) =>
		settings.routingHosts.includes(host)
			? settings
			: { ...settings, routingHosts: [...settings.routingHosts, host] },
	unpinHost: (settings: ClientSettings, host: string) => ({
		...settings,
		routingHosts: settings.routingHosts.filter((item) => item !== host),
	}),
	forgetSecrets: (settings: ClientSettings, host: string) => ({
		...settings,
		secretProxyHosts: settings.secretProxyHosts.filter((item) => item !== host),
	}),
	toggleTunnel: (settings: ClientSettings, mapping: TunnelMapping) => ({
		...settings,
		tunnelMappings: settings.tunnelMappings.map((item) =>
			item.key === mapping.key ? { ...item, enabled: mapping.enabled } : item,
		),
	}),
};
