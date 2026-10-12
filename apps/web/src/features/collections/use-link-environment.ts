/**
 * Choosing a collection's related environment (an Editor, environments
 * flag on): the server answers the collection, which replaces the cached
 * one; a refusal is toasted.
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { collectionErrorMessage } from "./collection-errors";
import { updateCollection } from "./collections-api";
import { collectionKey } from "./use-collections";

export function useLinkEnvironment(collectionId: string) {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	return useMutation({
		mutationFn: (environmentId: string | null) =>
			updateCollection(collectionId, { linkedEnvironmentId: environmentId }),
		onSuccess: (detail: CollectionDetail) => {
			client.setQueryData(collectionKey(detail.id), detail);
			const linked = detail.relatedEnvironment;
			toast.show({
				tone: "success",
				title: linked
					? t("collections.links.linked", { name: linked.name })
					: t("collections.links.unlinked"),
			});
		},
		onError: (error) =>
			toast.show({ tone: "error", title: collectionErrorMessage(error, t) }),
	});
}
