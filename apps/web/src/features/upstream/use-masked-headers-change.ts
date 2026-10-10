import {
	type UseMutationResult,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import {
	type OptimisticSnapshot,
	optimisticHandlers,
} from "../../lib/optimistic";
import {
	type TrafficSettings,
	saveRedactHeaders,
	trafficSettingsKey,
} from "./traffic-settings-api";

/**
 * Saves the project's masked header names (the whole list). The settings
 * cache takes the new list at once; a refused save restores the previous
 * one with an error toast. Saves of one project run one after another, so
 * each `PUT` carries the list as the user left it.
 */
export function useMaskedHeadersChange(
	projectId: string,
): UseMutationResult<
	TrafficSettings,
	unknown,
	string[],
	OptimisticSnapshot<TrafficSettings>
> {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const showError = (message: string) =>
		toast.show({
			tone: "error",
			title: t("upstream.masked.saveFailed"),
			description: message,
		});
	return useMutation({
		mutationFn: (headers: string[]) => saveRedactHeaders(projectId, headers),
		scope: { id: `redact-headers-${projectId}` },
		...optimisticHandlers<TrafficSettings, string[]>(client, showError, {
			queryKey: trafficSettingsKey(projectId),
			apply: (settings, headers) => ({ ...settings, redactHeaders: headers }),
		}),
	});
}
