import { type ReactNode, useState } from "react";
import { CodeBlock } from "../../components/ui/code-block";
import {
	SegmentedControl,
	type SegmentedOption,
} from "../../components/ui/segmented-control";
import { useT } from "../../i18n/i18n-context";
import { useTenantInfo } from "../../lib/tenant-info";
import {
	type CodeExample,
	EXAMPLE_LANGUAGES,
	type ExampleLanguage,
} from "./code-example";
import { CRUD_EXAMPLE, NESTED_EXAMPLE } from "./code-examples-crud";
import { ERRORS_EXAMPLE, PAGINATION_EXAMPLE } from "./code-examples-query";
import {
	DocsArticle,
	DocsSection,
	Prose,
	docsRich,
	linkTo,
} from "./docs-content";
import { docsPath, onThisDomain } from "./docs-pages";

/** Every example in reading order; tests check each has all languages. */
export const CODE_EXAMPLES: readonly CodeExample[] = [
	CRUD_EXAMPLE,
	NESTED_EXAMPLE,
	PAGINATION_EXAMPLE,
	ERRORS_EXAMPLE,
];

const LANGUAGE_OPTIONS: readonly SegmentedOption<ExampleLanguage>[] =
	EXAMPLE_LANGUAGES.map((language) => ({
		value: language.id,
		label: language.label,
		"data-id": `docs-language-${language.id}`,
	}));

/** `/docs/code-examples`: the same tasks in fetch, axios and curl. */
export function CodeExamplesPage() {
	const t = useT();
	const tenant = useTenantInfo();
	const [language, setLanguage] = useState<ExampleLanguage>("fetch");
	const label =
		EXAMPLE_LANGUAGES.find((item) => item.id === language)?.label ?? language;
	// Extra explanation under some examples, keyed by example id.
	const notes: Partial<Record<CodeExample["id"], ReactNode>> = {
		pagination: (
			<Prose>
				{docsRich(t("docs.codeExamples.paginationNote"), {
					countLink: linkTo(`${docsPath("custom-responses")}#count`),
					queryLink: linkTo(`${docsPath("quick-start")}#query`),
				})}
			</Prose>
		),
		errors: (
			<Prose>
				{docsRich(t("docs.codeExamples.errorsNote"), {
					statusLink: linkTo(`${docsPath("quick-start")}#status-codes`),
				})}
			</Prose>
		),
	};
	return (
		<DocsArticle
			title={t("docs.pages.codeExamples.title")}
			lead={t("docs.codeExamples.lead")}
			data-id="docs-code-examples"
		>
			<section
				aria-label={t("docs.codeExamples.howToRead")}
				className="grid gap-4"
			>
				<Prose>{docsRich(t("docs.codeExamples.intro"))}</Prose>
				<SegmentedControl
					legend={t("docs.codeExamples.languageLegend")}
					data-id="docs-language"
					options={LANGUAGE_OPTIONS}
					value={language}
					onChange={setLanguage}
				/>
			</section>
			{CODE_EXAMPLES.map((example) => (
				<DocsSection
					key={example.id}
					id={example.id}
					title={t(`docs.codeExamples.titles.${example.id}`)}
				>
					<CodeBlock
						caption={label}
						code={onThisDomain(example.code[language], tenant)}
						data-id={`docs-example-${example.id}`}
					/>
					{notes[example.id] ?? null}
				</DocsSection>
			))}
		</DocsArticle>
	);
}
