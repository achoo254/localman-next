import { limitsFor } from "@localman/shared";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useCurrentUser } from "../auth/use-current-user";

/** Limits a user can hit by creating something. */
export type ReachedLimit = "projects" | "resources" | "webhookInboxes";

/**
 * Tells the user, in plain words, which limit they reached (with its
 * number when the account's limits give one) and what they can do. The
 * product is not sold yet: nothing mentions plans or links to them.
 */
export function useLimitNotice(): (limit: ReachedLimit) => void {
	const t = useT();
	const toast = useToast();
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	return useCallback(
		(limit: ReachedLimit) => {
			const limits = limitsFor(plan);
			const title =
				limit === "projects"
					? t("limits.reached.projects", { count: limits.projects })
					: limit === "resources"
						? t("limits.reached.resources", { count: limits.resources })
						: t("limits.reached.webhookInboxes", {
								count: limits.webhookInboxes,
							});
			toast.show({ tone: "info", title, description: t("limits.feedback") });
		},
		[plan, t, toast],
	);
}
