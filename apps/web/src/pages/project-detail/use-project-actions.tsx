import { useState } from "react";
import { useToast } from "../../components/ui/toast";
import type { DataConfirm } from "../../features/resources/data-changes-confirm-modal";
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
import { errorMessage } from "../../lib/api-client";
import { useGenerateAction } from "./use-generate-action";

const withData = (changes: readonly DataChange[]) =>
	changes.filter((change) => change.countBefore > 0);

const mono = (name: string) => <b className="font-mono">{name}</b>;

/**
 * Data writes of the project page. Bulk writes and moves are previewed
 * with a dry run first: when they would replace or reset existing records
 * the user confirms the listed changes, otherwise they run at once.
 * `busy` covers the dry run and the real write, so Generate all and Reset
 * all stay disabled until the request has finished.
 */
export function useProjectActions(
	projectId: string,
	resources: readonly Resource[],
	askConfirm: (confirm: DataConfirm) => void,
) {
	const toast = useToast();
	const cache = useResourceCache(projectId);
	const generate = useGenerateAction(projectId, resources, askConfirm);
	const [running, setRunning] = useState(0);

	async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
		setRunning((count) => count + 1);
		try {
			return await work();
		} finally {
			setRunning((count) => count - 1);
		}
	}

	async function preview(load: () => Promise<DataChange[]>) {
		try {
			return await load();
		} catch (error) {
			toast.show({ tone: "error", title: resourceErrorMessage(error) });
			return null;
		}
	}

	/** Asks first when something would change, else runs now (still busy). */
	async function confirmOrRun(confirm: DataConfirm) {
		if (confirm.changes.length > 0) {
			askConfirm(confirm);
			return;
		}
		// `run` already rejects with the Vietnamese message.
		await confirm.run().catch((error: unknown) => {
			toast.show({ tone: "error", title: errorMessage(error) });
		});
	}

	const generateAll = () =>
		whileBusy(async () => {
			if (resources.length === 0) {
				toast.show({ tone: "info", title: "Project chưa có resource nào." });
				return;
			}
			const changes = await preview(() => generateAllData(projectId, true));
			if (!changes) return;
			await confirmOrRun({
				title: "Sinh tất cả",
				question: "Thay dữ liệu đang có?",
				lead: "Các resource sau đã có dữ liệu và sẽ được sinh lại:",
				confirmLabel: "Sinh dữ liệu",
				changes: withData(changes),
				"data-id": "modal-generate-all",
				run: () =>
					whileBusy(async () => {
						const done = await localized(generateAllData(projectId, false));
						cache.applyChanges(done);
						toast.show({
							title: "Đã sinh dữ liệu",
							description: (
								<>
									<b>{done.length}</b> resource có dữ liệu mới.
								</>
							),
						});
					}),
			});
		});

	const resetAll = () =>
		whileBusy(async () => {
			const changes = await preview(() => resetAllData(projectId, true));
			if (!changes) return;
			if (withData(changes).length === 0) {
				toast.show({ tone: "info", title: "Chưa có dữ liệu nào để reset." });
				return;
			}
			askConfirm({
				title: "Reset tất cả",
				question: "Xoá toàn bộ bản ghi?",
				lead: "Mọi resource về 0 bản ghi, schema và endpoint được giữ nguyên:",
				confirmLabel: "Reset dữ liệu",
				changes: withData(changes),
				"data-id": "modal-reset-all",
				run: () =>
					whileBusy(async () => {
						cache.applyChanges(await localized(resetAllData(projectId, false)));
						toast.show({ title: "Đã reset dữ liệu" });
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
			title: "Di chuyển resource",
			question: target
				? `Lồng “${resource.name}” vào “${target.name}”?`
				: `Đưa “${resource.name}” về root?`,
			lead: "Dữ liệu sau thuộc về resource cha cũ nên sẽ bị reset:",
			confirmLabel: "Di chuyển",
			changes: reset,
			"data-id": "modal-move-resource",
			run: async () => {
				await localized(moveResource(projectId, resource.id, parentId, false));
				await cache.invalidate();
				toast.show({
					title: target ? (
						<>
							Đã lồng {mono(resource.name)} vào {mono(target.name)}.
						</>
					) : (
						<>Đã đưa {mono(resource.name)} về root.</>
					),
					description:
						reset.length > 0 ? "Dữ liệu cũ đã được reset." : undefined,
				});
			},
		});
	}

	return { generate, generateAll, resetAll, move, busy: running > 0 };
}
