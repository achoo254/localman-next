import { useT } from "../../i18n/i18n-context";

/** Placeholder while a lazily loaded page's code is fetched. */
export function PageLoading() {
	const t = useT();
	return (
		<output
			data-id="page-loading"
			className="block py-16 text-center font-mono text-muted text-sm"
		>
			{t("layout.pageLoading")}
		</output>
	);
}
