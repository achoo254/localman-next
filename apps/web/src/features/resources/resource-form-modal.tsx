import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
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
		const result = validateDraft(draft, place, t);
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
			else setSubmitError(resourceErrorMessage(error, t));
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
					<Alert tone="danger">{t("resources.form.checkMarked")}</Alert>
				) : null}
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			</form>
		</Modal>
	);
}
