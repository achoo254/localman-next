import { MAX_RESOURCE_BYTES } from "@localman/shared/constants";
import { CodeBlock } from "../../components/ui/code-block";
import { useT } from "../../i18n/i18n-context";
import {
	DOCS_TEMPLATE_MAX_DEPTH,
	DOCS_TEMPLATE_MAX_FAKER_CALLS,
	DOCS_TEMPLATE_MAX_VALUES,
	FAKER_EXAMPLES,
	LIST_RESPONSE,
	LIST_TEMPLATE,
	WRITE_RESPONSE,
	WRITE_TEMPLATE,
	prettyJson,
} from "./custom-response-examples";
import {
	DocsArticle,
	DocsSection,
	DocsTable,
	InlineCode,
	Prose,
	docsRich,
} from "./docs-content";

const MB = 1024 * 1024;
const WRITE_BODY = '{"name":"Lan Anh"}';
const ERROR_SHAPE = '{ "error": { "code", "message" } }';
const FAKER_LIST = FAKER_EXAMPLES.map(
	(reference) => `<code>"${reference}"</code>`,
).join(", ");

/** `/docs/custom-responses`: response templates and disabled endpoints. */
export function CustomResponsesPage() {
	const t = useT();
	const variableRows = [
		[
			<InlineCode key="v">"$mockData"</InlineCode>,
			t("docs.customResponses.variables.mockData"),
		],
		[
			<InlineCode key="v">"$count"</InlineCode>,
			t("docs.customResponses.variables.count"),
		],
		[
			<InlineCode key="v">"$category.method"</InlineCode>,
			docsRich(
				t("docs.customResponses.variables.faker", { examples: FAKER_LIST }),
			),
		],
	];
	return (
		<DocsArticle
			title={t("docs.pages.customResponses.title")}
			lead={t("docs.customResponses.lead")}
			data-id="docs-custom-responses"
		>
			<DocsSection id="default" title={t("docs.customResponses.default.title")}>
				<Prose>{docsRich(t("docs.customResponses.default.body"))}</Prose>
			</DocsSection>

			<DocsSection id="edit" title={t("docs.customResponses.edit.title")}>
				<Prose>{t("docs.customResponses.edit.body")}</Prose>
			</DocsSection>

			<DocsSection
				id="variables"
				title={t("docs.customResponses.variables.title")}
			>
				<DocsTable
					caption={t("docs.customResponses.variables.caption")}
					headers={[
						t("docs.customResponses.variables.headerVariable"),
						t("docs.customResponses.variables.headerValue"),
					]}
					rows={variableRows}
					data-id="docs-template-variables"
				/>
				<Prose>
					{docsRich(t("docs.customResponses.variables.wholeString"))}
				</Prose>
			</DocsSection>

			<DocsSection id="count" title={t("docs.customResponses.count.title")}>
				<Prose>{t("docs.customResponses.count.body")}</Prose>
				<CodeBlock
					caption={t("docs.customResponses.count.templateCaption")}
					code={prettyJson(LIST_TEMPLATE)}
					data-id="docs-list-template"
				/>
				<CodeBlock
					caption={t("docs.customResponses.count.responseCaption")}
					code={prettyJson(LIST_RESPONSE)}
					data-id="docs-list-response"
				/>
			</DocsSection>

			<DocsSection id="write" title={t("docs.customResponses.write.title")}>
				<Prose>{docsRich(t("docs.customResponses.write.body"))}</Prose>
				<CodeBlock
					caption={t("docs.customResponses.write.templateCaption")}
					code={prettyJson(WRITE_TEMPLATE)}
					data-id="docs-write-template"
				/>
				<CodeBlock
					caption={t("docs.customResponses.write.responseCaption", {
						body: WRITE_BODY,
					})}
					code={prettyJson(WRITE_RESPONSE)}
					data-id="docs-write-response"
				/>
			</DocsSection>

			<DocsSection id="limits" title={t("docs.customResponses.limits.title")}>
				<Prose>
					{docsRich(
						t("docs.customResponses.limits.body", { errorShape: ERROR_SHAPE }),
					)}
				</Prose>
				<Prose>
					{docsRich(
						t("docs.customResponses.limits.size", {
							depth: DOCS_TEMPLATE_MAX_DEPTH,
							values: DOCS_TEMPLATE_MAX_VALUES,
							faker: DOCS_TEMPLATE_MAX_FAKER_CALLS,
							mb: MAX_RESOURCE_BYTES / MB,
						}),
					)}
				</Prose>
			</DocsSection>

			<DocsSection id="disable" title={t("docs.customResponses.disable.title")}>
				<Prose>{docsRich(t("docs.customResponses.disable.body"))}</Prose>
			</DocsSection>
		</DocsArticle>
	);
}
