import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import { CodeBlock } from "../../components/ui/code-block";
import { useT } from "../../i18n/i18n-context";
import { DocsSection, Prose, docsRich, linkTo } from "./docs-content";
import { docsPath } from "./docs-pages";
import { QueryParamsTable, ReservedParamsNote } from "./query-params";
import { StatusCodesTable } from "./status-codes";

/** Route listing shown as code: not translated, like every code sample. */
const NESTED_ROUTES = `GET    /customers/3/orders        orders of customer 3
GET    /customers/3/orders/12     order 12, if it belongs to customer 3
POST   /customers/3/orders        create an order, customerId = "3"
PUT    /customers/3/orders/12     update (PATCH works too)
DELETE /customers/3/orders/12     delete

GET    /orders                    every order of every customer
GET    /orders/12                 order 12
POST   /orders                    create an order, the body needs customerId`;

/** Generic error body of the mock, as the docs write it. */
const ERROR_BODY = '{ "error": { "code": "…", "message": "…" } }';

/** Step 5: nesting a resource under another and the routes it adds. */
export function NestedRoutesSection() {
	const t = useT();
	return (
		<DocsSection id="nested-routes" title={t("docs.quickStart.nested.title")}>
			<Prose>{docsRich(t("docs.quickStart.nested.intro"))}</Prose>
			<CodeBlock
				caption={t("docs.quickStart.nested.caption")}
				code={NESTED_ROUTES}
				data-id="docs-nested-routes"
			/>
			<Prose>{docsRich(t("docs.quickStart.nested.parentCheck"))}</Prose>
			<Prose>
				{docsRich(
					t("docs.quickStart.nested.depth", { depth: MAX_RESOURCE_DEPTH }),
				)}
			</Prose>
		</DocsSection>
	);
}

/** Step 6: filtering, sorting and paging list routes. */
export function QuerySection() {
	const t = useT();
	return (
		<DocsSection id="query" title={t("docs.quickStart.query.title")}>
			<Prose>
				{docsRich(t("docs.quickStart.query.intro"), {
					link: linkTo(`${docsPath("code-examples")}#pagination`),
				})}
			</Prose>
			<QueryParamsTable />
			<ReservedParamsNote />
			<Prose>{docsRich(t("docs.quickStart.query.rejected"))}</Prose>
		</DocsSection>
	);
}

/** Step 7: statuses and the error body. */
export function StatusSection() {
	const t = useT();
	return (
		<DocsSection id="status-codes" title={t("docs.quickStart.status.title")}>
			<Prose>
				{docsRich(t("docs.quickStart.status.body", { errorBody: ERROR_BODY }))}
			</Prose>
			<StatusCodesTable />
		</DocsSection>
	);
}
