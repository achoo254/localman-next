import { useId, useRef } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { CallbacksEditor } from "../mock-callbacks/callbacks-editor";
import { EndpointsEditor } from "./endpoints-editor";
import { ExportTypesMenu } from "./export-types-menu";
import { ObjectTemplateEditor } from "./object-template-editor";
import { ParentKeyField } from "./parent-key-field";
import { ResourceModalTitle } from "./resource-modal-title";
import type { Resource } from "./resource-model";
import { ResourceNameField } from "./resource-name-field";
import { SchemaEditor } from "./schema-editor";
import { useResourceForm } from "./use-resource-form";

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

/** "New resource" / "Edit resource": name, schema, template, endpoints. */
export function ResourceFormModal({
	projectId,
	resource,
	resources,
	onOpenChange,
	onSaved,
	onPlanLimit,
}: ResourceFormModalProps) {
	const t = useT();
	const { mockPowerUps, hybridMock } = useFeatures();
	const formId = useId();
	const nameInput = useRef<HTMLInputElement>(null);
	const form = useRef<HTMLFormElement>(null);
	const {
		place,
		draft,
		setDraft,
		errors,
		invalid,
		submitError,
		partial,
		setParentKey,
		parentKeyError,
		busy,
		dirty,
		callbacks,
		submit,
	} = useResourceForm({
		projectId,
		resource,
		resources,
		form,
		onSaved,
		onPlanLimit,
	});
	const editing = resource !== null;

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={
				editing ? (
					<ResourceModalTitle
						text={t("resources.form.titleEdit", { name: resource.name })}
					/>
				) : (
					t("resources.form.titleNew")
				)
			}
			size="xl"
			initialFocusRef={nameInput}
			data-id={editing ? "modal-edit-resource" : "modal-new-resource"}
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						loading={busy}
						data-id="resource-form-submit"
					>
						{editing ? t("resources.form.update") : t("resources.form.create")}
					</Button>
				</ModalFooter>
			}
		>
			<form
				ref={form}
				id={formId}
				noValidate
				onSubmit={submit}
				data-id="resource-form"
				className="grid gap-6"
			>
				<ResourceNameField
					ref={nameInput}
					value={draft.name}
					onChange={(name) => setDraft({ ...draft, name })}
					error={errors.name}
					parentName={place.parentName}
				/>
				{editing && place.parentKey !== null ? (
					<ParentKeyField
						value={draft.parentKey}
						onChange={setParentKey}
						error={parentKeyError}
						parentName={place.parentName ?? ""}
					/>
				) : null}
				<section className="grid gap-3" data-id="resource-form-schema">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="m-0 font-bold font-mono text-sm">Schema</h3>
						<span className="text-[0.8125rem] text-muted">
							{t("resources.form.schemaHint")}
						</span>
						{mockPowerUps && resource ? (
							<span className="ml-auto">
								<ExportTypesMenu
									resource={resource}
									resources={resources}
									unsaved={dirty}
									data-id="resource-form-export-types"
								/>
							</span>
						) : null}
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
					behaviorErrors={errors.behavior}
				/>
				{/* Saved by Update after the resource: a callback needs a saved one. */}
				{hybridMock && resource ? (
					<CallbacksEditor
						projectId={projectId}
						resourceId={resource.id}
						controller={callbacks}
					/>
				) : null}
				{invalid ? (
					<Alert tone="danger">{t("resources.form.checkMarked")}</Alert>
				) : null}
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
				{partial ? (
					<Alert
						tone="danger"
						title={t("resources.form.partialTitle")}
						data-id="resource-form-partial"
					>
						{t("resources.form.partialBody", { reason: partial.reason })}
					</Alert>
				) : null}
			</form>
		</Modal>
	);
}
