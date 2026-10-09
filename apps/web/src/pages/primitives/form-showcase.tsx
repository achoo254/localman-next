import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useT } from "../../i18n/i18n-context";
import { ShowcaseSection } from "./showcase-section";

export function FormShowcase() {
	const t = useT();
	return (
		<ShowcaseSection
			dataId="primitives-forms"
			title={t("primitives.forms.title")}
			description={t("primitives.forms.description")}
		>
			<div className="grid gap-4 md:grid-cols-2">
				<FormField
					label={t("primitives.forms.projectName")}
					hint={t("primitives.forms.projectNameHint")}
					required
				>
					<Input
						placeholder={t("primitives.forms.projectNamePlaceholder")}
						data-id="primitives-forms-name"
					/>
				</FormField>
				<FormField label="Endpoint" error={t("primitives.forms.endpointError")}>
					<Input defaultValue="/users" data-id="primitives-forms-endpoint" />
				</FormField>
				<FormField label={t("primitives.forms.method")}>
					<Select defaultValue="GET" data-id="primitives-forms-method">
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="PUT">PUT</option>
						<option value="DELETE">DELETE</option>
					</Select>
				</FormField>
				<FormField label={t("primitives.forms.disabled")}>
					<Input disabled defaultValue={t("primitives.forms.disabledValue")} />
				</FormField>
				<FormField label={t("primitives.forms.note")} className="md:col-span-2">
					<Textarea
						placeholder={t("primitives.forms.notePlaceholder")}
						data-id="primitives-forms-note"
					/>
				</FormField>
			</div>
		</ShowcaseSection>
	);
}
