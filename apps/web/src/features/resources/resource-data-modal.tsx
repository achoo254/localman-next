import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared/constants";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import {
	DataChangesConfirmModal,
	type DataConfirm,
} from "./data-changes-confirm-modal";
import { hasDescendantData, lostDescendants } from "./data-loss";
import { JsonSkeleton } from "./json-skeleton";
import { fetchResourceData, replaceResourceData } from "./resource-data-api";
import { ResourceDataEditor } from "./resource-data-editor";
import { localized, resourceErrorMessage } from "./resource-errors";
import { ResourceModalTitle } from "./resource-modal-title";
import type { DataChange, Resource } from "./resource-model";
import { checkRecords } from "./resource-records-check";

export { checkRecords } from "./resource-records-check";

/** Pause in typing before the text is parsed again (up to 2 MB of JSON). */
export const DATA_CHECK_DELAY_MS = 250;

export interface ResourceDataModalProps {
	projectId: string;
	resource: Resource;
	/** Every resource of the project, to know whether children hold data. */
	resources: readonly Resource[];
	onOpenChange: (open: boolean) => void;
	onUpdated: (resource: Resource, changes: DataChange[]) => void;
}

/**
 * "Data · {name}": the stored records as editable JSON. Update is only
 * enabled once the text changed and is a valid array of objects (checked
 * after a short pause, and on blur); it replaces the whole data. When the
 * new data would drop records of child resources, a dry run lists them
 * and the user confirms first.
 */
export function ResourceDataModal({
	projectId,
	resource,
	resources,
	onOpenChange,
	onUpdated,
}: ResourceDataModalProps) {
	const t = useT();
	const ids = useId();
	const data = useQuery({
		queryKey: ["projects", projectId, "resources", resource.id, "data"],
		queryFn: () => fetchResourceData(projectId, resource.id),
		gcTime: 0,
	});
	const records = data.data?.records;
	const original = useMemo(
		() => (records ? JSON.stringify(records, null, 2) : null),
		[records],
	);
	const [text, setText] = useState<string | null>(null);
	const [blurError, setBlurError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<DataConfirm | null>(null);
	const [busy, setBusy] = useState(false);
	const skeleton = useDelayedFlag(data.isPending);
	const current = text ?? original ?? "";
	const settled = useDebouncedValue(current, DATA_CHECK_DELAY_MS);
	const checked = useMemo(() => checkRecords(settled, t), [settled, t]);
	const changed = original !== null && current !== original;
	const ready = changed && settled === current && checked.error === null;

	async function update() {
		const fresh = checkRecords(current, t);
		if (!fresh.records || busy) return;
		const next = fresh.records;
		const write = async () => {
			const changes = await replaceResourceData(projectId, resource.id, next);
			onUpdated(resource, changes);
		};
		setBusy(true);
		setSubmitError(null);
		try {
			if (!hasDescendantData(resources, resource.id)) return await write();
			const lost = lostDescendants(
				await replaceResourceData(projectId, resource.id, next, true),
				resource.id,
			);
			if (lost.length === 0) return await write();
			setConfirm({
				title: t("resources.data.confirmTitle"),
				question: t("resources.data.confirmQuestion", { name: resource.name }),
				lead: t("resources.lostLead"),
				confirmLabel: t("resources.data.update"),
				changes: lost,
				"data-id": "modal-resource-data-confirm",
				run: () => localized(write(), t),
			});
		} catch (error) {
			setSubmitError(resourceErrorMessage(error, t));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={
				<ResourceModalTitle
					text={t("resources.data.title", { name: resource.name })}
				/>
			}
			size="lg"
			initialFocusRef="dialog"
			data-id="modal-resource-data"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						disabled={!ready}
						loading={busy}
						onClick={() => void update()}
						data-id="modal-resource-data-submit"
					>
						{t("resources.data.update")}
					</Button>
				</ModalFooter>
			}
		>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{t("resources.data.hint", { max: MAX_RECORDS_PER_RESOURCE })}
			</p>
			{skeleton ? (
				<SkeletonRegion
					data-id="modal-resource-data-loading"
					label={t("resources.data.loading")}
				>
					<JsonSkeleton />
				</SkeletonRegion>
			) : data.isPending ? null : data.isError ? (
				<Alert tone="danger" title={t("resources.data.loadFailed")}>
					{resourceErrorMessage(data.error, t)}
				</Alert>
			) : (
				<ResourceDataEditor
					name={resource.name}
					value={current}
					onChange={(next) => {
						setText(next);
						if (blurError) setBlurError(null);
					}}
					count={checked.records?.length ?? data.data.count}
					describedBy={`${ids}-hint${blurError ? ` ${ids}-error` : ""}`}
					invalid={Boolean(blurError)}
					onValidate={setBlurError}
				/>
			)}
			{blurError ? (
				<p id={`${ids}-error`} className="m-0 text-[0.8125rem] text-error">
					{blurError}
				</p>
			) : null}
			{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			{confirm ? (
				<DataChangesConfirmModal
					confirm={confirm}
					onOpenChange={(open) => !open && setConfirm(null)}
				/>
			) : null}
		</Modal>
	);
}
