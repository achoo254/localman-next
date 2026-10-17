import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../components/ui/toast";
import { errorMessage } from "../../../lib/api-client";
import { type LinkedMachine, tuneloAccountsApi } from "./tunelo-accounts-api";

export const TUNNEL_LINKS_KEY = ["api-client", "tunnel-links"] as const;
const LOCAL_TUNNELS_PREFIX = ["api-client", "local-tunnels"] as const;

/** The user's linked machines (Settings > Tunelo). */
export function useTunnelLinks() {
	return useQuery({
		queryKey: TUNNEL_LINKS_KEY,
		queryFn: tuneloAccountsApi.listLinks,
	});
}

/**
 * After a machine is linked or revoked: its list is replaced, and the
 * cached tunnels are read anew on the next send.
 */
export function useLinksChanged(): (links?: LinkedMachine[]) => void {
	const queryClient = useQueryClient();
	return (links) => {
		if (links) queryClient.setQueryData(TUNNEL_LINKS_KEY, links);
		else void queryClient.invalidateQueries({ queryKey: TUNNEL_LINKS_KEY });
		void queryClient.invalidateQueries({ queryKey: LOCAL_TUNNELS_PREFIX });
	};
}

/** Revokes a linked machine; a failure shows a toast. */
export function useRevokeLink() {
	const toast = useToast();
	const changed = useLinksChanged();
	return useMutation({
		mutationFn: tuneloAccountsApi.deleteLink,
		onSuccess: (links) => changed(links),
		onError: (error) => {
			toast.show({ tone: "error", title: errorMessage(error) });
		},
	});
}
