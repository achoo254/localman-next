import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";
import { type ScopeChoice, existingIn } from "./variable-targets";

export interface ExistingVariableNoteProps {
	choice: ScopeChoice | undefined;
	name: string;
	"data-id": string;
}

/**
 * Said before writing a name the chosen scope already has: its shared
 * value changes for everyone, a disabled one stays disabled, and the
 * caller's own local value of it is reset so the new value applies.
 */
export function ExistingVariableNote({
	choice,
	name,
	"data-id": dataId,
}: ExistingVariableNoteProps) {
	const t = useT();
	const key = name.trim();
	const existing = key ? existingIn(choice, key) : null;
	if (!existing) return null;
	return (
		<Alert tone="warning" data-id={dataId}>
			<span className="grid gap-1">
				<span>{t("variables.existing.replace", { name: key })}</span>
				{existing.enabled ? null : (
					<span>{t("variables.existing.disabled")}</span>
				)}
				{existing.hasLocal ? (
					<span>{t("variables.existing.local")}</span>
				) : null}
			</span>
		</Alert>
	);
}
