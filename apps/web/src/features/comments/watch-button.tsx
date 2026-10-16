import { IconEye, IconEyeCheck } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useCommentErrorMessage } from "./comment-errors";
import { useWatch } from "./use-comments";

export interface WatchButtonProps {
	collectionId: string;
	/** The collection's name, for the toasts. */
	name: string;
}

/**
 * Watch / Watching on a collection's page. In a personal workspace it is
 * shown disabled, with why: nobody else changes such a collection.
 */
export function WatchButton({ collectionId, name }: WatchButtonProps) {
	const t = useT();
	const toast = useToast();
	const errorText = useCommentErrorMessage();
	const { query, toggle } = useWatch(collectionId);
	const view = query.data;
	if (!view) return null;
	const watching = view.watching;
	const hint = view.available
		? t("collections.watch.hint")
		: t("collections.watch.personal");
	return (
		<Button
			size="sm"
			variant="secondary"
			data-id="collection-header-watch"
			aria-pressed={watching}
			disabled={!view.available}
			title={hint}
			loading={toggle.isPending}
			onClick={() =>
				toggle.mutate(!watching, {
					onSuccess: (next) =>
						toast.show({
							tone: "success",
							title: next.watching
								? t("collections.watch.started", { name })
								: t("collections.watch.stopped", { name }),
						}),
					onError: (error) =>
						toast.show({ tone: "error", title: errorText(error) }),
				})
			}
		>
			{watching ? (
				<IconEyeCheck size={16} aria-hidden="true" />
			) : (
				<IconEye size={16} aria-hidden="true" />
			)}
			{watching
				? t("collections.watch.watching")
				: t("collections.watch.watch")}
		</Button>
	);
}
