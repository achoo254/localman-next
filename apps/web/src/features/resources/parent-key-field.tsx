import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

export interface ParentKeyFieldProps {
	value: string;
	onChange: (value: string) => void;
	error: string | undefined;
	/** Name of the parent resource, for the hint. */
	parentName: string;
}

/**
 * "Parent key" of a nested resource: the field holding the parent record's
 * id in the mock's responses and its filter (`?userId=`). Renaming it
 * changes what clients read, which the hint says.
 */
export function ParentKeyField({
	value,
	onChange,
	error,
	parentName,
}: ParentKeyFieldProps) {
	const t = useT();
	return (
		<FormField
			label={t("resources.form.parentKeyLabel")}
			required
			error={error}
			data-id="resource-form-parent-key"
			hint={renderRich(
				t("resources.form.parentKeyHint", { parent: parentName }),
			)}
		>
			<Input
				className="font-mono"
				autoComplete="off"
				spellCheck={false}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</FormField>
	);
}
