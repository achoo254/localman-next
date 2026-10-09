import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import { EndpointsEditor } from "./endpoints-editor";
import { ObjectTemplateEditor } from "./object-template-editor";
import { resourceErrorMessage } from "./resource-errors";
import { type DraftErrors, draftOf, placeOf } from "./resource-form-state";
import { validateDraft } from "./resource-form-validation";
import type { Resource } from "./resource-model";
import { createResource, updateResource } from "./resources-api";
import { SchemaEditor } from "./schema-editor";

export interface ResourceFormModalProps {
	projectId: string;
	/** Resource being edited, or null to create one at the root. */
	resource: Resource | null;
	/** Every resource of the project (parent, children, sibling names). */
	resources: readonly Resource[];
	onOpenChange: (open: boolean) => void;
	onSaved: (resource: Resource, created: boolean) => void;
	/** The owner's plan has no room for another resource. */
	onPlanLimit: () => void;
}

const NO_ERRORS: DraftErrors = { fields: {}, endpoints: {} };

/** "Resource mới" / "Sửa resource": name, schema, template, endpoints. */
export function ResourceFormModal({
	projectId,
	resource,
	resources,
	onOpenChange,
	onSaved,
	onPlanLimit,
}: ResourceFormModalProps) {
	const formId = useId();
	const nameInput = useRef<HTMLInputElement>(null);
	const place = useMemo(
		() => placeOf(resource, resources),
		[resource, resources],
	);
	const [draft, setDraft] = useState(() => draftOf(resource));
	const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const editing = resource !== null;

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		const result = validateDraft(draft, place);
		setErrors(result.errors);
		if (!result.input) {
			if (result.errors.name) nameInput.current?.focus();
			return;
		}
		setBusy(true);
		setSubmitError(null);
		try {
			const saved = resource
				? await updateResource(projectId, resource.id, result.input)
				: await createResource(projectId, { ...result.input, parentId: null });
			onSaved(saved, !editing);
		} catch (error) {
			if (isPlanLimitError(error)) onPlanLimit();
			else setSubmitError(resourceErrorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	const invalidParts =
		Object.keys(errors.fields).length > 0 ||
		Object.keys(errors.endpoints).length > 0 ||
		errors.template !== undefined ||
		errors.schema !== undefined;

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={editing ? `Sửa resource · ${resource.name}` : "Resource mới"}
			size="xl"
			initialFocusRef={nameInput}
			data-id={editing ? "modal-edit-resource" : "modal-new-resource"}
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							Huỷ
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={busy}
						data-id="resource-form-submit"
					>
						{busy ? "Đang lưu…" : editing ? "Cập nhật" : "Tạo resource"}
					</Button>
				</ModalFooter>
			}
		>
			<form
				id={formId}
				noValidate
				onSubmit={submit}
				data-id="resource-form"
				className="grid gap-6"
			>
				<FormField
					label="Tên resource"
					required
					error={errors.name}
					data-id="resource-form-name"
					hint={
						<>
							Dùng làm đường dẫn endpoint, ví dụ <code>/users</code>. Chỉ gồm
							chữ không dấu, số, <code>-</code> và <code>_</code>.
							{place.parentName ? (
								<>
									{" "}
									Resource con của <code>{place.parentName}</code>.
								</>
							) : null}
						</>
					}
				>
					<Input
						ref={nameInput}
						placeholder="users"
						autoComplete="off"
						spellCheck={false}
						value={draft.name}
						onChange={(event) =>
							setDraft({ ...draft, name: event.target.value })
						}
					/>
				</FormField>
				<section className="grid gap-3" data-id="resource-form-schema">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="m-0 font-bold font-mono text-sm">Schema</h3>
						<span className="text-[0.8125rem] text-muted">
							Cấu trúc mỗi bản ghi
						</span>
					</div>
					<SchemaEditor
						fields={draft.fields}
						onChange={(fields) => setDraft({ ...draft, fields })}
						place={place}
						errors={errors.fields}
					/>
					{errors.schema ? (
						<p className="m-0 text-error text-xs">{errors.schema}</p>
					) : null}
				</section>
				<ObjectTemplateEditor
					value={draft.template}
					onChange={(template) => setDraft({ ...draft, template })}
					error={errors.template}
				/>
				<EndpointsEditor
					endpoints={draft.endpoints}
					onChange={(endpoints) => setDraft({ ...draft, endpoints })}
					resourceName={draft.name}
					errors={errors.endpoints}
				/>
				{invalidParts ? (
					<Alert tone="danger">Kiểm tra lại các ô được đánh dấu đỏ.</Alert>
				) : null}
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			</form>
		</Modal>
	);
}
