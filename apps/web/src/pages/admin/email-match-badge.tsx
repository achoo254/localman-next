import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";

/** Whether the address was the signed-in account's own (verified) email. */
export function EmailMatchBadge({ matches }: { matches: boolean }) {
	const t = useT();
	return matches ? (
		<Badge tone="success">{t("admin.emailMatches")}</Badge>
	) : (
		<Badge tone="warning">{t("admin.emailUnverified")}</Badge>
	);
}
