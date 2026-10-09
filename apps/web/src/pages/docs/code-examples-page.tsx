import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { CodeBlock } from "../../components/ui/code-block";
import {
	SegmentedControl,
	type SegmentedOption,
} from "../../components/ui/segmented-control";
import {
	type CodeExample,
	EXAMPLE_LANGUAGES,
	type ExampleLanguage,
} from "./code-example";
import { CRUD_EXAMPLE, NESTED_EXAMPLE } from "./code-examples-crud";
import { ERRORS_EXAMPLE, PAGINATION_EXAMPLE } from "./code-examples-query";
import { DocsArticle, DocsSection, InlineCode, Prose } from "./docs-content";
import { docsPath } from "./docs-pages";

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

/** Extra explanation under some examples, keyed by example id. */
const NOTES: Readonly<Record<string, ReactNode>> = {
	pagination: (
		<Prose>
			Danh sách mặc định chỉ là mảng bản ghi. Muốn nhận cả tổng số bản ghi để vẽ
			thanh phân trang, xem{" "}
			<Link to={`${docsPath("custom-responses")}#count`}>
				danh sách kèm tổng số bản ghi
			</Link>{" "}
			trong Custom responses. Mọi tham số được liệt kê ở{" "}
			<Link to={`${docsPath("quick-start")}#query`}>bảng tham số query</Link>.
		</Prose>
	),
	errors: (
		<Prose>
			Mỗi response có header <InlineCode>X-Localman-Request-Id</InlineCode>. Xem
			thêm{" "}
			<Link to={`${docsPath("quick-start")}#status-codes`}>
				bảng mã trạng thái và mã lỗi
			</Link>
			.
		</Prose>
	),
};

/** `/docs/code-examples`: the same tasks in fetch, axios and curl. */
export function CodeExamplesPage() {
	const [language, setLanguage] = useState<ExampleLanguage>("fetch");
	const label =
		EXAMPLE_LANGUAGES.find((item) => item.id === language)?.label ?? language;
	return (
		<DocsArticle
			title="Code examples"
			lead="Gọi mock API bằng fetch, axios hoặc curl: đọc, ghi, route lồng, phân trang và xử lý lỗi."
			data-id="docs-code-examples"
		>
			<section aria-label="Cách đọc ví dụ" className="grid gap-4">
				<Prose>
					Ví dụ dùng resource <InlineCode>customers</InlineCode> và resource{" "}
					<InlineCode>orders</InlineCode> lồng bên trong, với các field{" "}
					<InlineCode>product</InlineCode>, <InlineCode>quantity</InlineCode> và{" "}
					<InlineCode>paid</InlineCode>. Thay{" "}
					<InlineCode>{"<secret>"}</InlineCode> bằng secret trong thẻ API
					endpoint của project. Các khối sau dùng lại{" "}
					<InlineCode>BASE_URL</InlineCode>,{" "}
					<InlineCode>JSON_HEADERS</InlineCode> và <InlineCode>api</InlineCode>{" "}
					khai báo ở khối đầu tiên.
				</Prose>
				<SegmentedControl
					legend="Ngôn ngữ của ví dụ"
					data-id="docs-language"
					options={LANGUAGE_OPTIONS}
					value={language}
					onChange={setLanguage}
				/>
			</section>
			{CODE_EXAMPLES.map((example) => (
				<DocsSection key={example.id} id={example.id} title={example.title}>
					<CodeBlock
						caption={label}
						code={example.code[language]}
						data-id={`docs-example-${example.id}`}
					/>
					{NOTES[example.id] ?? null}
				</DocsSection>
			))}
		</DocsArticle>
	);
}
