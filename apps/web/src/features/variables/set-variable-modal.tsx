import { type FormEvent, useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Textarea } from "../../components/ui/textarea";
import { useT } from "../../i18n/i18n-context";
import { ExistingVariableNote } from "./existing-variable-note";
import { choiceLabel, choiceNote } from "./scope-choice-labels";
import {
	type ApplyVariable,
	nameError,
	valueError,
} from "./use-apply-variable";
import {
	type ScopeChoice,
	type TargetScope,
	defaultScope,
} from "./variable-targets";

export interface SetVariableModalProps {
	/** The selected text; the modal is closed while `null`. */
	value: string | null;
	choices: readonly ScopeChoice[];
	apply: ApplyVariable;
	onClose: () => void;
}

const CHOICE_IDS: Record<TargetScope, string> = {
	environment: "modal-set-variable-env",
	collection: "modal-set-variable-collection",
	global: "modal-set-variable-global",
	temporary: "modal-set-variable-temp",
};

/** "Set as variable": a name, the selected value and where it goes. */
export function SetVariableModal(props: SetVariableModalProps) {
	return props.value === null ? null : (
		<SetVariableForm {...props} value={props.value} />
	);
}

function SetVariableForm({
	value: selected,
	choices,
	apply,
	onClose,
}: SetVariableModalProps & { value: string }) {
	const t = useT();
	const formId = useId();
	const nameRef = useRef<HTMLInputElement>(null);
	const [name, setName] = useState("");
	const [value, setValue] = useState(selected);
	const [scope, setScope] = useState<TargetScope>(() => defaultScope(choices));
	const [errors, setErrors] = useState<{ name?: string; value?: string }>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const next = {
			name: nameError(name, t) ?? undefined,
			value: valueError(value, t) ?? undefined,
		};
		setErrors(next);
		if (next.name || next.value) return;
		setBusy(true);
		setFailure(null);
		try {
			await apply(scope, name, value);
			onClose();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : String(error));
			setBusy(false);
		}
	};

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
			title={t("variables.set.title")}
			size="md"
			initialFocusRef={nameRef}
			data-id="modal-set-variable"
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
						data-id="modal-set-variable-submit"
					>
						{t("variables.set.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form id={formId} className="grid gap-4" noValidate onSubmit={submit}>
				<FormField label={t("variables.set.name")} error={errors.name} required>
					<Input
						ref={nameRef}
						value={name}
						placeholder={t("variables.set.namePlaceholder")}
						autoComplete="off"
						spellCheck={false}
						data-id="modal-set-variable-name"
						onChange={(event) => setName(event.target.value)}
					/>
				</FormField>
				<FormField label={t("variables.set.value")} error={errors.value}>
					<Textarea
						value={value}
						rows={2}
						spellCheck={false}
						data-id="modal-set-variable-value"
						className="font-mono"
						onChange={(event) => setValue(event.target.value)}
					/>
				</FormField>
				<fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
					<legend className="mb-2 font-mono font-semibold text-[0.8125rem]">
						{t("variables.set.scope")}
					</legend>
					{choices.map((choice) => (
						<label
							key={choice.scope}
							className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-60"
						>
							<input
								type="radio"
								name={`${formId}-scope`}
								value={choice.scope}
								checked={scope === choice.scope}
								disabled={choice.blocked !== null}
								className="size-4 accent-primary"
								data-id={CHOICE_IDS[choice.scope]}
								onChange={() => setScope(choice.scope)}
							/>
							<span className="grid min-w-0">
								<span className="truncate font-mono font-semibold text-sm">
									{choiceLabel(choice, t)}
								</span>
								<span className="text-muted text-xs">
									{choiceNote(choice, t)}
								</span>
							</span>
						</label>
					))}
				</fieldset>
				<ExistingVariableNote
					choice={choices.find((choice) => choice.scope === scope)}
					name={name}
					data-id="modal-set-variable-existing"
				/>
				{failure ? (
					<Alert tone="danger" data-id="modal-set-variable-error">
						{failure}
					</Alert>
				) : null}
			</form>
		</Modal>
	);
}
