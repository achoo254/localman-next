import type { Ref } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

export interface ResourceNameFieldProps {
	ref: Ref<HTMLInputElement>;
	value: string;
	onChange: (value: string) => void;
	error: string | undefined;
	/** Parent of a nested resource, named in the hint. */
	parentName: string | null;
}

/** "Resource name" of the resource form: the endpoint path segment. */
export function ResourceNameField({
	ref,
	value,
	onChange,
	error,
	parentName,
}: ResourceNameFieldProps) {
	const t = useT();
	return (
		<FormField
			label={t("resources.form.nameLabel")}
			required
			error={error}
			data-id="resource-form-name"
			hint={
				<>
					{renderRich(t("resources.form.nameHint"))}
					{parentName ? (
						<>
							{" "}
							{renderRich(t("resources.form.childOf", { parent: parentName }))}
						</>
					) : null}
				</>
			}
		>
			<Input
				ref={ref}
				placeholder="users"
				autoComplete="off"
				spellCheck={false}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</FormField>
	);
}
