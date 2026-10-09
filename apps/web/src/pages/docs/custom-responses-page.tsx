import { MAX_RESOURCE_BYTES, limitsFor } from "@localman/shared/constants";
import { Fragment } from "react";
import { CodeBlock } from "./code-block";
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
} from "./docs-content";

const number = new Intl.NumberFormat("vi-VN");

const VARIABLE_ROWS = [
	[
		<InlineCode key="v">"$mockData"</InlineCode>,
		"Dữ liệu endpoint trả về khi không có template: mảng bản ghi (đã lọc, sắp xếp, cắt trang) với GET danh sách, một bản ghi với các endpoint còn lại.",
	],
	[
		<InlineCode key="v">"$count"</InlineCode>,
		"Số bản ghi. Ở GET danh sách là số bản ghi khớp bộ lọc, tính trước khi cắt trang. Ở endpoint khác là số bản ghi của collection theo route, đếm sau khi ghi (trên route lồng chỉ đếm bản ghi con của bản ghi cha đó).",
	],
	[
		<InlineCode key="v">"$category.method"</InlineCode>,
		<Fragment key="d">
			Một giá trị Faker sinh mới ở mỗi request, ví dụ{" "}
			{FAKER_EXAMPLES.map((reference, index) => (
				<Fragment key={reference}>
					{index > 0 ? ", " : null}
					<InlineCode>"{reference}"</InlineCode>
				</Fragment>
			))}
			. Dùng được mọi method có trong ô chọn Faker của schema.
		</Fragment>,
	],
] as const;

/** `/docs/custom-responses`: response templates and disabled endpoints. */
export function CustomResponsesPage() {
	return (
		<DocsArticle
			title="Custom responses"
			lead="Đổi hình dạng body mà từng endpoint trả về, ví dụ bọc danh sách trong một object có tổng số bản ghi, hoặc tắt hẳn một endpoint."
			data-id="docs-custom-responses"
		>
			<DocsSection id="default" title="Mặc định">
				<Prose>
					Mỗi endpoint có một response template. Template mặc định là chuỗi{" "}
					<InlineCode>"$mockData"</InlineCode>, nghĩa là body chính là dữ liệu:
					GET danh sách trả mảng, GET một bản ghi trả object, POST trả bản ghi
					mới, PUT và PATCH trả bản ghi sau khi sửa, DELETE trả bản ghi vừa xoá.
				</Prose>
			</DocsSection>

			<DocsSection id="edit" title="Sửa template">
				<Prose>
					Bấm Sửa trên resource. Mục Endpoints liệt kê năm endpoint, mỗi cái có
					công tắc bật tắt và ô Response template nhận JSON. Bấm Cập nhật để
					lưu; request kế tiếp dùng template mới ngay.
					{limitsFor("free").customResponse
						? " Custom response dùng được ở mọi gói, kể cả Free."
						: null}
				</Prose>
			</DocsSection>

			<DocsSection id="variables" title="Biến trong template">
				<DocsTable
					caption="Ba loại biến của response template"
					headers={["Biến", "Giá trị"]}
					rows={VARIABLE_ROWS}
					data-id="docs-template-variables"
				/>
				<Prose>
					Một chuỗi chỉ được thay khi <em>cả chuỗi</em> là một biến:{" "}
					<InlineCode>"Xin chào $name.firstName"</InlineCode> được giữ nguyên
					chữ. Số, boolean, chuỗi thường, object và mảng lồng nhau giữ nguyên;
					biến nằm sâu trong object vẫn được thay. Biến không tồn tại, như lỗi
					gõ <InlineCode>"$mockdata"</InlineCode>, bị từ chối ngay lúc lưu.
				</Prose>
			</DocsSection>

			<DocsSection id="count" title="Danh sách kèm tổng số bản ghi">
				<Prose>
					Template này cho endpoint GET danh sách trả về trang dữ liệu cùng tổng
					số bản ghi, đủ để vẽ thanh phân trang:
				</Prose>
				<CodeBlock
					caption="Template của GET /customers"
					code={prettyJson(LIST_TEMPLATE)}
					data-id="docs-list-template"
				/>
				<CodeBlock
					caption="GET /customers?page=2&limit=10 (rút gọn còn 2 bản ghi)"
					code={prettyJson(LIST_RESPONSE)}
					data-id="docs-list-response"
				/>
			</DocsSection>

			<DocsSection id="write" title="Bọc bản ghi khi ghi">
				<Prose>
					Với POST, PUT và DELETE, <InlineCode>"$mockData"</InlineCode> là một
					bản ghi, còn <InlineCode>"$count"</InlineCode> là số bản ghi sau khi
					ghi. PATCH dùng chung template với PUT.
				</Prose>
				<CodeBlock
					caption="Template của POST /customers"
					code={prettyJson(WRITE_TEMPLATE)}
					data-id="docs-write-template"
				/>
				<CodeBlock
					caption={'POST /customers với body {"name":"Lan Anh"}'}
					code={prettyJson(WRITE_RESPONSE)}
					data-id="docs-write-response"
				/>
			</DocsSection>

			<DocsSection id="limits" title="Những gì template không đổi">
				<Prose>
					Template chỉ đổi body. Mã trạng thái giữ nguyên (200, hoặc 201 với
					POST), và lỗi không đi qua template: 404 vẫn là{" "}
					<InlineCode>"Not found"</InlineCode>, lỗi khác vẫn là{" "}
					<InlineCode>{'{ "error": { "code", "message" } }'}</InlineCode>.
				</Prose>
				<Prose>
					Một template sâu tối đa {DOCS_TEMPLATE_MAX_DEPTH} tầng, có tối đa{" "}
					{number.format(DOCS_TEMPLATE_MAX_VALUES)} giá trị và{" "}
					{DOCS_TEMPLATE_MAX_FAKER_CALLS} biến Faker. Body sau khi render vượt{" "}
					{MAX_RESOURCE_BYTES / 1024 / 1024} MB thì nhận 422{" "}
					<InlineCode>RESPONSE_TOO_LARGE</InlineCode>; giảm số bản ghi bằng{" "}
					<InlineCode>limit</InlineCode>.
				</Prose>
			</DocsSection>

			<DocsSection id="disable" title="Tắt một endpoint">
				<Prose>
					Tắt công tắc của một endpoint thì route đó trả 404{" "}
					<InlineCode>"Not found"</InlineCode> trên cả route phẳng lẫn route
					lồng, các endpoint khác vẫn chạy. PATCH đi theo công tắc của PUT, HEAD
					đi theo GET. Ví dụ: tắt DELETE để người dùng thử bản demo không xoá
					được dữ liệu mẫu.
				</Prose>
			</DocsSection>
		</DocsArticle>
	);
}
