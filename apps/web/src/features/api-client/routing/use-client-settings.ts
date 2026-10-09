import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../../../components/ui/toast";
import { errorMessage } from "../../../lib/api-client";
import {
	type ClientSettings,
	DEFAULT_CLIENT_SETTINGS,
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
