import { Alert } from "../../../components/ui/alert";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";

/** Shown wherever a tunnel is suggested: it exposes the local service. */
export function TunnelWarning() {
	const t = useT();
	return (
		<Alert
			tone="warning"
			title={t("apiClientTunelo.warning.title")}
			data-id="tunelo-warning"
		>
			<p className="m-0 text-xs">
				{renderRich(t("apiClientTunelo.warning.body"))}
			</p>
		</Alert>
	);
}
