import { MAX_RESOURCE_DEPTH } from "@localman/shared/constants";
import { Link } from "react-router";
import { CodeBlock } from "../../components/ui/code-block";
import { DocsSection, InlineCode, Prose } from "./docs-content";
import { docsPath } from "./docs-pages";
import { QueryParamsTable, ReservedParamsNote } from "./query-params";
import { StatusCodesTable } from "./status-codes";

const NESTED_ROUTES = `GET    /customers/3/orders        các order của customer 3
GET    /customers/3/orders/12     order 12, nếu nó thuộc customer 3
POST   /customers/3/orders        tạo order, customerId = "3"
PUT    /customers/3/orders/12     cập nhật (PATCH cũng được)
DELETE /customers/3/orders/12     xoá

GET    /orders                    mọi order của mọi customer
GET    /orders/12                 order 12
POST   /orders                    tạo order, body phải có customerId`;

/** Step 5: nesting a resource under another and the routes it adds. */
export function NestedRoutesSection() {
	return (
		<DocsSection id="nested-routes" title="5. Route lồng">
			<Prose>
				Trên cây resource, bấm chấm tròn bên trái{" "}
				<InlineCode>orders</InlineCode> rồi bấm chấm tròn bên phải{" "}
				<InlineCode>customers</InlineCode> để lồng, khi đó mỗi order thuộc về
				một customer. Bản ghi của <InlineCode>orders</InlineCode> có thêm field{" "}
				<InlineCode>customerId</InlineCode> (tên cha ở số ít cộng{" "}
				<InlineCode>Id</InlineCode>), và mock phục vụ cả route lồng lẫn route
				phẳng:
			</Prose>
			<CodeBlock
				caption="Route của orders"
				code={NESTED_ROUTES}
				data-id="docs-nested-routes"
			/>
			<Prose>
				Route lồng kiểm tra từng bản ghi cha trên đường dẫn: customer 3 không
				tồn tại, hoặc order 12 thuộc customer khác, thì trả 404. POST trên route
				lồng lấy <InlineCode>customerId</InlineCode> từ đường dẫn; POST trên
				route phẳng cần <InlineCode>customerId</InlineCode> trỏ tới một customer
				có thật, nếu không sẽ nhận 400.
			</Prose>
			<Prose>
				Cây lồng được tới {MAX_RESOURCE_DEPTH} tầng, ví dụ{" "}
				<InlineCode>/customers/3/orders/12/items</InlineCode>. Route phẳng{" "}
				<InlineCode>/orders</InlineCode> chỉ trỏ tới resource lồng khi không
				resource nào khác trong cây trùng tên; nếu có một resource gốc cùng tên
				thì route phẳng thuộc về resource gốc đó.
			</Prose>
		</DocsSection>
	);
}

/** Step 6: filtering, sorting and paging list routes. */
export function QuerySection() {
	return (
		<DocsSection id="query" title="6. Lọc, sắp xếp, phân trang">
			<Prose>
				Route danh sách (cả phẳng lẫn lồng) nhận các tham số dưới đây, kết hợp
				tuỳ ý. Thứ tự xử lý là lọc, rồi sắp xếp, rồi cắt trang. Ví dụ đầy đủ ở{" "}
				<Link to={`${docsPath("code-examples")}#pagination`}>
					Code examples
				</Link>
				.
			</Prose>
			<QueryParamsTable />
			<ReservedParamsNote />
			<Prose>
				Tên tham số bắt đầu bằng <InlineCode>$</InlineCode>, chứa{" "}
				<InlineCode>.</InlineCode> hoặc ngoặc vuông, và tham số gửi hai lần đều
				bị từ chối với 400 <InlineCode>INVALID_QUERY</InlineCode>, nên cú pháp
				toán tử kiểu <InlineCode>?price[$gt]=10</InlineCode> không dùng được.
			</Prose>
		</DocsSection>
	);
}

/** Step 7: statuses and the error body. */
export function StatusSection() {
	return (
		<DocsSection id="status-codes" title="7. Mã trạng thái và lỗi">
			<Prose>
				Lỗi có body dạng{" "}
				<InlineCode>
					{'{ "error": { "code": "…", "message": "…" } }'}
				</InlineCode>
				. Riêng 404 khi secret đúng định dạng trả về đúng chuỗi JSON{" "}
				<InlineCode>"Not found"</InlineCode>; secret sai định dạng nhận lỗi dạng
				chung với <InlineCode>NOT_FOUND</InlineCode>. Dựa vào{" "}
				<InlineCode>code</InlineCode> để xử lý, vì{" "}
				<InlineCode>message</InlineCode> có thể đổi câu chữ.
			</Prose>
			<StatusCodesTable />
		</DocsSection>
	);
}
