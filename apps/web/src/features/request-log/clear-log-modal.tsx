import { useQuery } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { clearLog } from "./request-log-api";

export interface ClearLogModalProps {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCleared: () => void;
}

/**
 * Confirms clearing the project's whole log. A dry run counts the lines
 * first (the table holds only some of them); confirm waits for it and
 * stays possible if the count fails.
 */
export function ClearLogModal({
	projectId,
	open,
	onOpenChange,
	onCleared,
}: ClearLogModalProps) {
	const t = useT();
	const toast = useToast();
	const count = useQuery({
		queryKey: ["request-log-clear-preview", projectId],
		queryFn: () => clearLog(projectId, true),
		enabled: open,
		gcTime: 0,
	});
	const counting = useDelayedFlag(open && count.isPending);
	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t("trafficLog.clear.title")}
			question={t("trafficLog.clear.question")}
			confirmLabel={t("trafficLog.clear.confirm")}
			confirmDisabled={count.isPending}
			data-id="modal-clear-log"
			onConfirm={async () => {
				await clearLog(projectId, false);
				onCleared();
				toast.show({ tone: "success", title: t("trafficLog.clear.done") });
			}}
		>
			<p className="m-0 text-sm">{t("trafficLog.clear.body")}</p>
			{counting ? (
				<SkeletonRegion
					data-id="modal-clear-log-counting"
					label={t("trafficLog.clear.counting")}
					className="mt-1 flex h-5 items-center"
				>
					<Skeleton className="h-3 w-48" />
				</SkeletonRegion>
			) : count.isPending ? null : (
				<p className="m-0 mt-1 text-sm">
					{count.isError
						? errorMessage(count.error)
						: t("trafficLog.clear.count", { count: count.data })}
				</p>
			)}
		</ConfirmModal>
	);
}
