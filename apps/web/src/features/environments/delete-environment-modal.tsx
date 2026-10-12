import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { deleteEnvironment } from "./environments-api";
import {
	ENVIRONMENTS_KEY,
	activeEnvironmentKey,
	environmentKey,
	environmentListKey,
} from "./use-environments";

export interface DeleteEnvironmentModalProps {
	environmentId: string;
	workspaceId: string;
	name: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** After it is gone (close its tab). */
	onDeleted: () => void;
}

/**
 * Deletes an environment for good: the dry run names how many variables
 * go with it before the button turns on.
 */
export function DeleteEnvironmentModal(props: DeleteEnvironmentModalProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const dry = useQuery({
		queryKey: [...ENVIRONMENTS_KEY, "delete-dry-run", props.environmentId],
		queryFn: () => deleteEnvironment(props.environmentId, true),
		enabled: props.open,
		staleTime: 0,
		gcTime: 0,
	});
	return (
		<ConfirmModal
			open={props.open}
			onOpenChange={props.onOpenChange}
			data-id="environment-delete"
			title={t("environments.delete.title")}
			question={t("environments.delete.question", { name: props.name })}
			confirmLabel={t("environments.delete.confirm")}
			confirmDisabled={!dry.data}
			onConfirm={async () => {
				await deleteEnvironment(props.environmentId, false);
				client.removeQueries({ queryKey: environmentKey(props.environmentId) });
				await Promise.all([
					client.invalidateQueries({
						queryKey: environmentListKey(props.workspaceId),
					}),
					client.invalidateQueries({
						queryKey: activeEnvironmentKey(props.workspaceId),
					}),
				]);
				toast.show({
					tone: "success",
					title: t("environments.delete.done", { name: props.name }),
				});
				props.onDeleted();
			}}
		>
			<p className="m-0">
				{dry.data
					? t("environments.delete.summary", { count: dry.data.variables })
					: dry.isError
						? errorMessage(dry.error)
						: t("environments.delete.counting")}
			</p>
		</ConfirmModal>
	);
}
