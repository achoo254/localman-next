import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";

const SR_ONLY = {
	sr: (chunk: string) => <span className="sr-only">{chunk}</span>,
};

/**
 * "suggested · from the field name" under a schema field, lined up with
 * the method column from 640px; the method combobox points at it with
 * `aria-describedby`.
 */
export function SuggestedMethodNote({
	id,
	position,
}: { id: string; position: number }) {
	const t = useT();
	return (
		<p
			id={id}
			data-id={`resource-form-field-${position}-suggested`}
			className="m-0 flex flex-wrap items-center gap-2 text-muted text-xs sm:grid sm:grid-cols-10"
		>
			<span className="flex items-center gap-2 sm:col-span-3 sm:col-start-7">
				<Badge tone="primary">{t("resources.schema.suggested")}</Badge>
				<span>{renderRich(t("resources.schema.suggestedHint"), SR_ONLY)}</span>
			</span>
		</p>
	);
}
