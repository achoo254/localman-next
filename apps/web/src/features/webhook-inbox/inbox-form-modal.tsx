import { useId, useRef } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { InboxView } from "./inbox-api";
import { MAX_NAME } from "./inbox-form-state";
import { InboxForwardFields } from "./inbox-forward-fields";
import { InboxResponseFields } from "./inbox-response-fields";
import { useInboxForm } from "./use-inbox-form";

export interface InboxFormModalProps {
	projectId: string;
	/** The inbox to edit, or null to create one. */
	inbox: InboxView | null;
	/** `https://{secret}.{mock host}/_inbox/`, for the URL preview. */
	urlBase: string;
	onOpenChange: (open: boolean) => void;
	onPlanLimit: () => void;
}

/**
 * "Create webhook inbox" / "Edit inbox": name (create only), the response
 * senders get and optional forwarding to the owner's tunnel. Loaded
 * lazily: the body editor is CodeMirror.
 */
export function InboxFormModal({
	projectId,
	inbox,
	urlBase,
	onOpenChange,
	onPlanLimit,
}: InboxFormModalProps) {
	const t = useT();
	const formId = useId();
	const form = useRef<HTMLFormElement>(null);
	const first = useRef<HTMLInputElement>(null);
	const { stored, draft, change, errors, formError, busy, submit } =
		useInboxForm({
			projectId,
			inbox,
			form,
			onDone: () => onOpenChange(false),
			onPlanLimit,
		});
	const editing = stored !== null;

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={
				editing
					? t("webhookInbox.form.titleEdit", { name: stored.name })
					: t("webhookInbox.form.titleNew")
			}
			size="lg"
			initialFocusRef={first}
			data-id={editing ? "modal-edit-inbox" : "modal-new-inbox"}
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy} data-id="modal-cancel">
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						disabled={busy}
						data-id="modal-submit"
					>
						{busy
							? t(
									editing
										? "webhookInbox.form.saving"
										: "webhookInbox.form.creating",
								)
							: t(
									editing
										? "webhookInbox.form.submitEdit"
										: "webhookInbox.form.submitNew",
								)}
					</Button>
				</ModalFooter>
			}
		>
			<form
				ref={form}
				id={formId}
				noValidate
				className="grid gap-6"
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<FormField
					label={t("webhookInbox.form.name")}
					required
					error={errors.name}
					hint={
						<>
							{renderRich(t("webhookInbox.form.nameHint"))}{" "}
							{t("webhookInbox.form.urlPreview")}{" "}
							<code data-id="inbox-form-url-preview" className="wrap-anywhere">
								{`${urlBase}${draft.name.trim() || "…"}`}
							</code>
						</>
					}
				>
					<Input
						ref={editing ? undefined : first}
						value={draft.name}
						maxLength={MAX_NAME}
						placeholder="stripe"
						autoComplete="off"
						spellCheck={false}
						disabled={editing}
						onChange={(event) => change("name", event.target.value)}
						data-id="inbox-form-name"
					/>
				</FormField>
				<InboxResponseFields
					draft={draft}
					errors={errors}
					onChange={change}
					statusRef={editing ? first : undefined}
				/>
				<InboxForwardFields draft={draft} errors={errors} onChange={change} />
				{formError ? <Alert tone="danger">{formError}</Alert> : null}
			</form>
		</Modal>
	);
}
