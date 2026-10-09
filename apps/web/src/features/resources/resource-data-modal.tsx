import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared/constants";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { JsonEditor } from "../../components/ui/json-editor";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import {
	DataChangesConfirmModal,
	type DataConfirm,
} from "./data-changes-confirm-modal";
import { hasDescendantData, lostDescendants } from "./data-loss";
import { fetchResourceData, replaceResourceData } from "./resource-data-api";
import { localized, resourceErrorMessage } from "./resource-errors";
import type { DataChange, Resource } from "./resource-model";
import { checkRecords, recordsProblem } from "./resource-records-check";

export { checkRecords } from "./resource-records-check";

/** Pause in typing before the text is parsed again (up to 2 MB of JSON). */
export const DATA_CHECK_DELAY_MS = 250;

export interface ResourceDataModalProps {
	projectId: string;
	resource: Resource;
	/** Every resource of the project, to know whether children hold data. */
	resources: readonly Resource[];
	/** Collaborators see the records without the Update button. */
	readOnly: boolean;
	onOpenChange: (open: boolean) => void;
	onUpdated: (resource: Resource, changes: DataChange[]) => void;
}

/**
 * "Dữ liệu · {name}": the stored records as editable JSON. Update is only
 * enabled once the text changed and is a valid array of objects (checked
 * after a short pause, and on blur); it replaces the whole data. When the
 * new data would drop records of child resources, a dry run lists them
 * and the user confirms first.
 */
export function ResourceDataModal({
	projectId,
	resource,
	resources,
	readOnly,
	onOpenChange,
	onUpdated,
}: ResourceDataModalProps) {
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
	const current = text ?? original ?? "";
	const settled = useDebouncedValue(current, DATA_CHECK_DELAY_MS);
	const checked = useMemo(() => checkRecords(settled), [settled]);
	const changed = original !== null && current !== original;
	const ready = changed && settled === current && checked.error === null;

	async function update() {
		const fresh = checkRecords(current);
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
				title: "Cập nhật dữ liệu",
				question: `Thay dữ liệu của “${resource.name}”?`,
				lead: "Các resource con sau sẽ mất dữ liệu:",
				confirmLabel: "Cập nhật",
				changes: lost,
				"data-id": "modal-resource-data-confirm",
				run: () => localized(write()),
			});
		} catch (error) {
			setSubmitError(resourceErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={`Dữ liệu · ${resource.name}`}
			size="lg"
			initialFocusRef="dialog"
			data-id="modal-resource-data"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{readOnly ? "Đóng" : "Huỷ"}
						</Button>
					</ModalClose>
					{readOnly ? null : (
						<Button
							variant="primary"
							disabled={busy || !ready}
							onClick={() => void update()}
							data-id="modal-resource-data-submit"
						>
							{busy ? "Đang cập nhật…" : "Cập nhật"}
						</Button>
					)}
				</ModalFooter>
			}
		>
			<p id={`${ids}-hint`} className="m-0 text-[0.8125rem] text-muted">
				{readOnly
					? "Bản ghi đang lưu của resource."
					: `Sửa trực tiếp hoặc dán một mảng JSON mới để thay toàn bộ dữ liệu (tối đa ${MAX_RECORDS_PER_RESOURCE} bản ghi).`}
			</p>
			{data.isPending ? (
				<output className="block py-6 font-mono text-muted text-sm">
					Đang tải dữ liệu…
				</output>
			) : data.isError ? (
				<Alert tone="danger" title="Không tải được dữ liệu">
					{resourceErrorMessage(data.error)}
				</Alert>
			) : (
				<JsonEditor
					value={current}
					onChange={(next) => {
						setText(next);
						if (blurError) setBlurError(null);
					}}
					label={`Dữ liệu JSON của ${resource.name}`}
					describedBy={`${ids}-hint${blurError ? ` ${ids}-error` : ""}`}
					readOnly={readOnly}
					invalid={Boolean(blurError)}
					validate={recordsProblem}
					onValidate={setBlurError}
					className="h-[min(60vh,28rem)]"
					data-id="modal-resource-data-json"
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
