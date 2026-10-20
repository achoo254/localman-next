import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";

export type PendingItem =
	| "operator"
	| "minimumAge"
	| "liability"
	| "governingLaw"
	| "logRetention";

/**
 * "Being updated": the parts a page does not state yet because nothing
 * decided them (docs/legal-pages-review.md). Listed instead of guessed.
 */
export function LegalPendingNotice({
	items,
	"data-id": dataId,
}: {
	items: readonly PendingItem[];
	"data-id": string;
}) {
	const t = useT();
	return (
		<Alert tone="info" title={t("legal.pending.title")} data-id={dataId}>
			<p className="m-0">{t("legal.pending.body")}</p>
			<ul className="m-0 mt-1 grid list-disc gap-1 pl-5">
				{items.map((item) => (
					<li key={item}>{t(`legal.pending.items.${item}`)}</li>
				))}
			</ul>
		</Alert>
	);
}
