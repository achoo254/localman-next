import { useId, useRef } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { EndpointsEditor } from "./endpoints-editor";
import { ExportTypesMenu } from "./export-types-menu";
import { ObjectTemplateEditor } from "./object-template-editor";
import type { Resource } from "./resource-model";
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
	const { mockPowerUps } = useFeatures();
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
		busy,
		dirty,
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
				editing
					? t("resources.form.titleEdit", { name: resource.name })
					: t("resources.form.titleNew")
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
						disabled={busy}
						data-id="resource-form-submit"
					>
						{busy
							? t("resources.form.saving")
							: editing
								? t("resources.form.update")
								: t("resources.form.create")}
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
				<FormField
					label={t("resources.form.nameLabel")}
					required
					error={errors.name}
					data-id="resource-form-name"
					hint={
						<>
							{renderRich(t("resources.form.nameHint"))}
							{place.parentName ? (
								<>
									{" "}
									{renderRich(
										t("resources.form.childOf", { parent: place.parentName }),
									)}
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
							{t("resources.form.schemaHint")}
						</span>
						{mockPowerUps && resource ? (
							<span className="ml-auto">
								<ExportTypesMenu
									resource={resource}
									resources={resources}
									variant="form"
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
				{invalid ? (
					<Alert tone="danger">{t("resources.form.checkMarked")}</Alert>
				) : null}
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			</form>
		</Modal>
	);
}
