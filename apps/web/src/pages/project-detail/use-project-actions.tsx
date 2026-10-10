import { useState } from "react";
import { useToast } from "../../components/ui/toast";
import {
	generateAllData,
	resetAllData,
} from "../../features/resources/resource-data-api";
import {
	localized,
	resourceErrorMessage,
} from "../../features/resources/resource-errors";
import type {
	DataChange,
	Resource,
} from "../../features/resources/resource-model";
import { moveResource } from "../../features/resources/resources-api";
import { useResourceCache } from "../../features/resources/use-resources";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import type { ProjectConfirm } from "./project-detail-dialogs";
import { toastText } from "./toast-text";
import { useGenerateAction } from "./use-generate-action";

/** A bulk button of the endpoint card. */
export type BulkAction = "generateAll" | "resetAll";

const withData = (changes: readonly DataChange[]) =>
	changes.filter((change) => change.countBefore > 0);

/**
 * Data writes of the project page. Bulk writes and moves are previewed
 * with a dry run first: when they would replace or reset existing records
 * the user confirms the listed changes, otherwise they run at once.
 * `busy` covers the dry run and the real write, so Generate all and Reset
 * all stay disabled until it has finished. `pressed` names the bulk button
 * whose request runs (its spinner), until a confirmation opens.
 */
export function useProjectActions(
	projectId: string,
	resources: readonly Resource[],
	askConfirm: (confirm: ProjectConfirm) => void,
) {
	const t = useT();
	const toast = useToast();
	const cache = useResourceCache(projectId);
	const generate = useGenerateAction(projectId, resources, askConfirm);
	const [running, setRunning] = useState(0);
	const [pressed, setPressed] = useState<BulkAction | null>(null);

	async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
		setRunning((count) => count + 1);
		try {
			return await work();
		} finally {
			setRunning((count) => count - 1);
		}
	}

	async function whilePressed(action: BulkAction, work: () => Promise<void>) {
		setPressed(action);
		try {
			await whileBusy(work);
		} finally {
			setPressed(null);
		}
	}

	async function preview(load: () => Promise<DataChange[]>) {
		try {
			return await load();
		} catch (error) {
			toast.show({ tone: "error", title: resourceErrorMessage(error, t) });
			return null;
		}
	}

	/** Asks first when something would change, else runs now (still busy). */
	async function confirmOrRun(confirm: ProjectConfirm) {
		if (confirm.changes.length > 0) {
			askConfirm(confirm);
			return;
		}
		// `run` already rejects with the translated message.
		await confirm.run().catch((error: unknown) => {
			toast.show({ tone: "error", title: errorMessage(error) });
		});
	}

	const generateAll = () =>
		whilePressed("generateAll", async () => {
			if (resources.length === 0) {
				toast.show({
					tone: "info",
					title: t("projectDetail.generateAll.empty"),
				});
				return;
			}
			const changes = await preview(() => generateAllData(projectId, true));
			if (!changes) return;
			await confirmOrRun({
				title: t("projectDetail.endpoint.generateAll"),
				question: t("projectDetail.generateAll.question"),
				lead: t("projectDetail.generateAll.lead"),
				confirmLabel: t("projectDetail.generate.title"),
				changes: withData(changes),
				summarize: true,
				"data-id": "modal-generate-all",
				run: () =>
					whileBusy(async () => {
						const done = await localized(generateAllData(projectId, false), t);
						cache.applyChanges(done);
						toast.show({
							title: t("projectDetail.toast.generated"),
							description: toastText(
								t("projectDetail.toast.generatedAll", { count: done.length }),
							),
						});
					}),
			});
		});

	const resetAll = () =>
		whilePressed("resetAll", async () => {
			const changes = await preview(() => resetAllData(projectId, true));
			if (!changes) return;
			if (withData(changes).length === 0) {
				toast.show({
					tone: "info",
					title: t("projectDetail.resetAll.nothing"),
				});
				return;
			}
			askConfirm({
				title: t("projectDetail.endpoint.resetAll"),
				question: t("projectDetail.resetAll.question"),
				lead: t("projectDetail.resetAll.lead"),
				confirmLabel: t("projectDetail.resetAll.confirm"),
				changes: withData(changes),
				"data-id": "modal-reset-all",
				run: () =>
					whileBusy(async () => {
						cache.applyChanges(
							await localized(resetAllData(projectId, false), t),
						);
						toast.show({ title: t("projectDetail.toast.reset") });
					}),
			});
		});

	async function move(resource: Resource, target: Resource | null) {
		const parentId = target?.id ?? null;
		const changes = await preview(() =>
			moveResource(projectId, resource.id, parentId, true),
		);
		if (!changes) return;
		const reset = withData(changes);
		await confirmOrRun({
			title: t("projectDetail.move.title"),
			question: target
				? t("projectDetail.move.nestQuestion", {
						name: resource.name,
						target: target.name,
					})
				: t("projectDetail.move.rootQuestion", { name: resource.name }),
			lead: t("projectDetail.move.lead"),
			confirmLabel: t("projectDetail.move.confirm"),
			changes: reset,
			"data-id": "modal-move-resource",
			run: async () => {
				await localized(
					moveResource(projectId, resource.id, parentId, false),
					t,
				);
				await cache.invalidate();
				toast.show({
					title: toastText(
						target
							? t("projectDetail.toast.nested", {
									name: resource.name,
									target: target.name,
								})
							: t("projectDetail.toast.movedToRoot", { name: resource.name }),
					),
					description:
						reset.length > 0
							? t("projectDetail.toast.oldDataReset")
							: undefined,
				});
			},
		});
	}

	return {
		generate,
		generateAll,
		resetAll,
		move,
		busy: running > 0,
		pressed,
	};
}
