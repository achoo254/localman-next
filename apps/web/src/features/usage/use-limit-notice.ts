import { LIMITS } from "@localman/shared/constants";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";

/** Limits a user can hit by creating something. */
export type ReachedLimit = "projects" | "resources" | "webhookInboxes";

/**
 * Tells the user, in plain words, which limit they reached (with its
 * number) and what they can do. Every account has the same limits, so
 * nothing mentions plans or upgrading.
 */
export function useLimitNotice(): (limit: ReachedLimit) => void {
	const t = useT();
	const toast = useToast();
	return useCallback(
		(limit: ReachedLimit) => {
			const title =
				limit === "projects"
					? t("limits.reached.projects", { count: LIMITS.projects })
					: limit === "resources"
						? t("limits.reached.resources", { count: LIMITS.resources })
						: t("limits.reached.webhookInboxes", {
								count: LIMITS.webhookInboxes,
							});
			toast.show({ tone: "info", title, description: t("limits.feedback") });
		},
		[t, toast],
	);
}
