import { Navigate } from "react-router";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { DocsArticle, DocsSection, Prose, docsRich } from "./docs-content";
import { docsPath } from "./docs-pages";

const SECTIONS = ["ways", "hidden", "kept", "who", "keys", "run"] as const;

/** `/docs/public-sharing`: what each way of sharing outside shows and hides. */
export function PublicSharingPage() {
	const t = useT();
	const { publicSharing } = useFeatures();
	if (!publicSharing) {
		return <Navigate to={docsPath("quick-start")} replace />;
	}
	return (
		<DocsArticle
			title={t("docs.pages.publicSharing.title")}
			lead={t("docs.publicSharing.lead")}
			data-id="docs-public-sharing"
		>
			{SECTIONS.map((section) => (
				<DocsSection
					key={section}
					id={section}
					title={t(`docs.publicSharing.${section}.title`)}
				>
					<Prose>{docsRich(t(`docs.publicSharing.${section}.body`))}</Prose>
				</DocsSection>
			))}
		</DocsArticle>
	);
}
