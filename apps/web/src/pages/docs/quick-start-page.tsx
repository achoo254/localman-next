import { MAX_GENERATE_COUNT, limitsFor } from "@localman/shared/constants";
import { Link } from "react-router";
import {
	DocsArticle,
	DocsSection,
	DocsTable,
	InlineCode,
	Prose,
} from "./docs-content";
import { MOCK_URL_FALLBACK, MOCK_URL_PATTERN, docsPath } from "./docs-pages";
import {
	NestedRoutesSection,
	QuerySection,
	StatusSection,
} from "./quick-start-sections";

const FREE = limitsFor("free");

const ENDPOINT_ROWS = [
	[
		"GET",
		<InlineCode key="r">/customers</InlineCode>,
		"200: mảng bản ghi. Lọc, sắp xếp và phân trang qua query.",
	],
	["GET", <InlineCode key="r">/customers/:id</InlineCode>, "200: một bản ghi."],
	[
		"POST",
		<InlineCode key="r">/customers</InlineCode>,
		"201: bản ghi mới, id là số kế tiếp. Field của schema mà body bỏ trống được sinh như khi bấm sinh dữ liệu.",
	],
	[
		"PUT, PATCH",
		<InlineCode key="r">/customers/:id</InlineCode>,
		"200: field trong body được gộp vào bản ghi, field không gửi giữ nguyên. Không đổi được id.",
	],
	[
		"DELETE",
		<InlineCode key="r">/customers/:id</InlineCode>,
		"200: bản ghi vừa xoá. Mọi bản ghi con của nó ở các resource lồng bên dưới cũng bị xoá.",
	],
] as const;

/** `/docs/quick-start`: from an empty project to a callable mock API. */
export function QuickStartPage() {
	return (
		<DocsArticle
			title="Quick start"
			lead="Tạo một mock REST API có dữ liệu thật để frontend hoặc test gọi vào, không cần dựng backend."
			data-id="docs-quick-start"
		>
			<DocsSection id="create-project" title="1. Tạo project">
				<Prose>
					Ở trang Projects, bấm Tạo project, đặt tên và nếu muốn thì thêm API
					Prefix như <InlineCode>/api/v1</InlineCode>. Mỗi project có một secret
					riêng nằm ngay trong URL của mock; thẻ API endpoint trong trang
					project hiện sẵn URL đầy đủ. Gói Free có {FREE.projects} project,{" "}
					{FREE.resources} resource mỗi project.
				</Prose>
			</DocsSection>

			<DocsSection id="mock-url" title="2. URL của mock API">
				<DocsTable
					caption="Hai dạng URL của cùng một project"
					headers={["Dạng", "URL", "Dùng khi"]}
					rows={[
						[
							"Subdomain",
							<InlineCode key="u">{MOCK_URL_PATTERN}</InlineCode>,
							"Mặc định.",
						],
						[
							"Đường dẫn",
							<InlineCode key="u">{MOCK_URL_FALLBACK}</InlineCode>,
							"Mạng hoặc công cụ của bạn không phân giải được subdomain riêng của project.",
						],
					]}
					data-id="docs-mock-url"
				/>
				<Prose>
					Secret có vai trò như mật khẩu: ai có URL đều đọc và ghi được dữ liệu
					mock. Chủ project bấm Đổi URL mock để cấp secret mới; URL cũ trả 404
					ngay, dữ liệu giữ nguyên. Đường dẫn phân biệt chữ hoa và chữ thường.
				</Prose>
				<Prose>
					Mock trả JSON và cho phép mọi origin gọi qua CORS (không gửi cookie),
					nên trang web chạy ở đâu cũng gọi thẳng được. Mỗi response có header{" "}
					<InlineCode>X-Localman-Request-Id</InlineCode>, hãy gửi kèm mã này khi
					cần hỗ trợ.
				</Prose>
			</DocsSection>

			<DocsSection id="add-resource" title="3. Thêm resource và sinh dữ liệu">
				<Prose>
					Bấm Thêm resource và đặt tên theo số nhiều, ví dụ{" "}
					<InlineCode>customers</InlineCode>: tên này là đoạn đầu của route.
					Schema là danh sách field của mỗi bản ghi; field có thể là kiểu cơ bản
					hoặc một method Faker để sinh tên, email, ngày tháng… Rê chuột trên
					thanh sinh dữ liệu của resource rồi bấm vào số bản ghi muốn có (0 đến{" "}
					{MAX_GENERATE_COUNT}). Mỗi bản ghi có <InlineCode>id</InlineCode> dạng
					chuỗi, đánh số từ <InlineCode>"1"</InlineCode>.
				</Prose>
			</DocsSection>

			<DocsSection id="endpoints" title="4. Năm endpoint của một resource">
				<DocsTable
					caption="Endpoint của resource customers"
					headers={["Method", "Route", "Kết quả"]}
					rows={ENDPOINT_ROWS}
					data-id="docs-endpoints"
				/>
				<Prose>
					Body của POST, PUT và PATCH là một object JSON, gửi kèm header{" "}
					<InlineCode>Content-Type: application/json</InlineCode>; thiếu header
					này thì body bị coi như rỗng. Từng endpoint tắt được hoặc đổi được
					hình dạng body trả về, xem{" "}
					<Link to={docsPath("custom-responses")}>Custom responses</Link>.
				</Prose>
			</DocsSection>

			<NestedRoutesSection />
			<QuerySection />
			<StatusSection />
		</DocsArticle>
	);
}
