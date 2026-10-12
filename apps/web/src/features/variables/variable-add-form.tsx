import { type FormEvent, useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import { ExistingVariableNote } from "./existing-variable-note";
import { choiceOption } from "./scope-choice-labels";
import {
	type ApplyVariable,
	nameError,
	valueError,
} from "./use-apply-variable";
import {
	type ScopeChoice,
	TARGET_SCOPES,
	type TargetScope,
	defaultScope,
} from "./variable-targets";

export interface VariableAddFormProps {
	name: string;
	choices: readonly ScopeChoice[];
	apply: ApplyVariable;
	/** After the variable was added. */
	onDone: () => void;
}

function isTargetScope(value: string): value is TargetScope {
	return TARGET_SCOPES.some((scope) => scope === value);
}

/** "Add to" of an undeclared variable's card: scope and value. */
export function VariableAddForm({
	name,
	choices,
	apply,
	onDone,
}: VariableAddFormProps) {
	const t = useT();
	const [scope, setScope] = useState<TargetScope>(() => defaultScope(choices));
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const sharedOpen = choices.some(
		(choice) => choice.scope !== "temporary" && choice.blocked === null,
	);

	const invalidName = nameError(name, t);
	if (invalidName) {
		return (
			<p
				data-id="var-tooltip-name-error"
				className="m-0 border-border-subtle border-t pt-2 text-error-text text-xs"
			>
				{invalidName}
			</p>
		);
	}

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const invalid = valueError(value, t);
		if (invalid) {
			setError(invalid);
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await apply(scope, name, value);
			onDone();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : String(failure));
		} finally {
			setBusy(false);
		}
	};

	return (
		<form
			data-id="var-tooltip-add-form"
			className="grid gap-2 border-border-subtle border-t pt-2"
			onSubmit={submit}
		>
			<FormField label={t("variables.add.scope")}>
				<Select
					data-id="var-tooltip-scope"
					value={scope}
					onChange={(event) => {
						if (isTargetScope(event.target.value)) setScope(event.target.value);
					}}
				>
					{choices.map((choice) => (
						<option
							key={choice.scope}
							value={choice.scope}
							disabled={choice.blocked !== null}
						>
							{choiceOption(choice, t)}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={t("variables.add.value")}
				error={error ?? undefined}
				announceError
			>
				<Input
					data-id="var-tooltip-value"
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
			</FormField>
			<ExistingVariableNote
				choice={choices.find((choice) => choice.scope === scope)}
				name={name}
				data-id="var-tooltip-existing"
			/>
			{sharedOpen ? null : (
				<p className="m-0 text-muted text-xs">
					{t("variables.add.viewerNote")}
				</p>
			)}
			<Button
				type="submit"
				size="sm"
				variant="primary"
				loading={busy}
				data-id="var-tooltip-add"
			>
				{t("variables.add.submit")}
			</Button>
		</form>
	);
}
