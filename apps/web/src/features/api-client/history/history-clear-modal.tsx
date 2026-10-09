import { useQuery } from "@tanstack/react-query";
import { ConfirmModal } from "../../../components/ui/confirm-modal";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { clearHistory } from "./history-api";
import { useClearHistory } from "./use-history";

export interface HistoryClearModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Confirms clearing the whole history. A dry run counts the entries first
 * (the list may hold only the newest page); confirm waits for it, and
 * stays possible if the count fails.
 */
export function HistoryClearModal({
	open,
	onOpenChange,
}: HistoryClearModalProps) {
	const t = useT();
	const toast = useToast();
	const clear = useClearHistory();
	const count = useQuery({
		// Outside the list key: clearing must not re-run this preview.
		queryKey: ["api-client", "history-clear-preview"],
		queryFn: () => clearHistory(true),
		enabled: open,
		gcTime: 0,
	});
	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t("apiClientTools.history.clearTitle")}
			question={t("apiClientTools.history.clearQuestion")}
			confirmLabel={t("apiClientTools.history.clearConfirm")}
			confirmDisabled={count.isPending}
			data-id="modal-history-clear"
			onConfirm={async () => {
				await clear.mutateAsync();
				toast.show({
					tone: "success",
					title: t("apiClientTools.history.cleared"),
				});
			}}
		>
			<p className="m-0 text-sm">
				{count.isPending
					? t("apiClientTools.history.clearCounting")
					: count.isError
						? errorMessage(count.error)
						: t("apiClientTools.history.clearCount", { count: count.data })}
			</p>
		</ConfirmModal>
	);
}
