import {
	type UseMutationResult,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type TrafficSettings,
	fetchTrafficSettings,
	trafficSettingsKey,
} from "./traffic-settings-api";

/** Upstream, masked headers and log retention of a project. */
export function useTrafficSettings(
	projectId: string,
): UseQueryResult<TrafficSettings> {
	return useQuery({
		queryKey: trafficSettingsKey(projectId),
		queryFn: () => fetchTrafficSettings(projectId),
	});
}

/** A settings change whose answer (the new settings) replaces the cache. */
export function useTrafficSettingsChange<Arg>(
	projectId: string,
	change: (arg: Arg) => Promise<TrafficSettings>,
): UseMutationResult<TrafficSettings, unknown, Arg> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: change,
		onSuccess: (settings) => {
			queryClient.setQueryData(trafficSettingsKey(projectId), settings);
		},
	});
}
