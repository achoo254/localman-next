import { MAX_GENERATE_COUNT, limitsFor } from "@localman/shared/constants";
import { useT } from "../../i18n/i18n-context";
import {
	DocsArticle,
	DocsSection,
	DocsTable,
	InlineCode,
	Prose,
	docsRich,
	linkTo,
} from "./docs-content";
import { MOCK_URL_FALLBACK, MOCK_URL_PATTERN, docsPath } from "./docs-pages";
import {
	NestedRoutesSection,
	QuerySection,
	StatusSection,
} from "./quick-start-sections";

const FREE = limitsFor("free");

/** `/docs/quick-start`: from an empty project to a callable mock API. */
export function QuickStartPage() {
	const t = useT();
	const route = (path: string) => <InlineCode key="r">{path}</InlineCode>;
	const endpointRows = [
		["GET", route("/customers"), t("docs.quickStart.endpoints.list")],
		["GET", route("/customers/:id"), t("docs.quickStart.endpoints.get")],
		["POST", route("/customers"), t("docs.quickStart.endpoints.post")],
		["PUT, PATCH", route("/customers/:id"), t("docs.quickStart.endpoints.put")],
		["DELETE", route("/customers/:id"), t("docs.quickStart.endpoints.delete")],
	];
	return (
		<DocsArticle
			title={t("docs.pages.quickStart.title")}
			lead={t("docs.quickStart.lead")}
			data-id="docs-quick-start"
		>
			<DocsSection
				id="create-project"
				title={t("docs.quickStart.createProject.title")}
			>
				<Prose>
					{docsRich(
						t("docs.quickStart.createProject.body", {
							projects: FREE.projects,
							resources: FREE.resources,
						}),
					)}
				</Prose>
			</DocsSection>

			<DocsSection id="mock-url" title={t("docs.quickStart.mockUrl.title")}>
				<DocsTable
					caption={t("docs.quickStart.mockUrl.caption")}
					headers={[
						t("docs.quickStart.mockUrl.headerForm"),
						t("docs.quickStart.mockUrl.headerUrl"),
						t("docs.quickStart.mockUrl.headerWhen"),
					]}
					rows={[
						[
							t("docs.quickStart.mockUrl.subdomain"),
							<InlineCode key="u">{MOCK_URL_PATTERN}</InlineCode>,
							t("docs.quickStart.mockUrl.subdomainWhen"),
						],
						[
							t("docs.quickStart.mockUrl.path"),
							<InlineCode key="u">{MOCK_URL_FALLBACK}</InlineCode>,
							t("docs.quickStart.mockUrl.pathWhen"),
						],
					]}
					data-id="docs-mock-url"
				/>
				<Prose>{t("docs.quickStart.mockUrl.secret")}</Prose>
				<Prose>{docsRich(t("docs.quickStart.mockUrl.cors"))}</Prose>
			</DocsSection>

			<DocsSection
				id="add-resource"
				title={t("docs.quickStart.addResource.title")}
			>
				<Prose>
					{docsRich(
						t("docs.quickStart.addResource.body", { max: MAX_GENERATE_COUNT }),
					)}
				</Prose>
			</DocsSection>

			<DocsSection id="endpoints" title={t("docs.quickStart.endpoints.title")}>
				<DocsTable
					caption={t("docs.quickStart.endpoints.caption")}
					headers={[
						t("docs.headerMethod"),
						t("docs.headerRoute"),
						t("docs.quickStart.endpoints.headerResult"),
					]}
					rows={endpointRows}
					data-id="docs-endpoints"
				/>
				<Prose>
					{docsRich(t("docs.quickStart.endpoints.body"), {
						link: linkTo(docsPath("custom-responses")),
					})}
				</Prose>
			</DocsSection>

			<NestedRoutesSection />
			<QuerySection />
			<StatusSection />
		</DocsArticle>
	);
}
