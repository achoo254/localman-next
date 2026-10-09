import {
	MAX_PAGE_LIMIT,
	MOCK_QUERY_PARAMS as QUERY_PARAM_ALIASES,
} from "@localman/shared/constants";
import { Fragment, type ReactNode } from "react";
import { DocsTable, InlineCode, Prose } from "./docs-content";

function Names({ names }: { names: readonly string[] }) {
	return (
		<span className="flex flex-wrap gap-1">
			{names.map((name) => (
				<InlineCode key={name}>{name}</InlineCode>
			))}
		</span>
	);
}

const ROWS: readonly (readonly ReactNode[])[] = [
	[
		<Names key="n" names={QUERY_PARAM_ALIASES.search} />,
		<Fragment key="d">
			Tìm chuỗi con, không phân biệt hoa thường, trong mọi giá trị chuỗi ở cấp
			đầu của bản ghi (kể cả <InlineCode>id</InlineCode>). Gửi cả hai thì bản
			ghi phải chứa cả hai chuỗi.
		</Fragment>,
		<InlineCode key="e">?search=lan</InlineCode>,
	],
	[
		<Names key="n" names={["<field>"]} />,
		<Fragment key="d">
			Lọc theo một field của schema, theo <InlineCode>id</InlineCode> hoặc{" "}
			<InlineCode>{"{parent}Id"}</InlineCode>. Field chuỗi khớp chuỗi con không
			phân biệt hoa thường; số và boolean khớp đúng giá trị;{" "}
			<InlineCode>null</InlineCode> khớp chữ <InlineCode>null</InlineCode>;{" "}
			<InlineCode>id</InlineCode> và <InlineCode>{"{parent}Id"}</InlineCode>{" "}
			khớp nguyên giá trị. Nhiều field thì bản ghi phải khớp tất cả. Tên không
			phải field bị bỏ qua.
		</Fragment>,
		<InlineCode key="e">?paid=false</InlineCode>,
	],
	[
		<Names key="n" names={QUERY_PARAM_ALIASES.page} />,
		<Fragment key="d">
			Số trang, đếm từ 1. Chỉ có tác dụng khi có <InlineCode>limit</InlineCode>.
			Thiếu hoặc sai thì là trang 1.
		</Fragment>,
		<InlineCode key="e">?page=2&limit=10</InlineCode>,
	],
	[
		<Names key="n" names={QUERY_PARAM_ALIASES.limit} />,
		<Fragment key="d">
			Số bản ghi mỗi trang, tối đa {MAX_PAGE_LIMIT} (số lớn hơn được hạ về{" "}
			{MAX_PAGE_LIMIT}). Không gửi thì nhận mọi bản ghi.
		</Fragment>,
		<InlineCode key="e">?l=20</InlineCode>,
	],
	[
		<Names key="n" names={QUERY_PARAM_ALIASES.sort} />,
		<Fragment key="d">
			Sắp xếp theo một field. Số và chuỗi chỉ chứa số được so như số, nên{" "}
			<InlineCode>"2"</InlineCode> đứng trước <InlineCode>"10"</InlineCode>.
			Field không tồn tại bị bỏ qua.
		</Fragment>,
		<InlineCode key="e">?sortBy=createdAt</InlineCode>,
	],
	[
		<Names key="n" names={QUERY_PARAM_ALIASES.order} />,
		<Fragment key="d">
			<InlineCode>desc</InlineCode> để sắp giảm dần; mặc định tăng dần.
		</Fragment>,
		<InlineCode key="e">?order=desc</InlineCode>,
	],
];

/** Every reserved name, in the order the table lists them. */
const RESERVED_NAMES: readonly string[] =
	Object.values(QUERY_PARAM_ALIASES).flat();

/**
 * A schema field named like a reserved parameter is read as that
 * parameter, so it cannot be used as a filter.
 */
export function ReservedParamsNote() {
	return (
		<Prose>
			Field có tên trùng một tham số dành riêng không lọc được, vì mock đọc tên
			đó như tham số:{" "}
			{RESERVED_NAMES.map((name, index) => (
				<Fragment key={name}>
					{index > 0 ? ", " : null}
					<InlineCode>{name}</InlineCode>
				</Fragment>
			))}
			. Đặt tên field khác nếu cần lọc theo nó.
		</Prose>
	);
}

/** Query parameters of `GET /:res`, rendered from the alias lists above. */
export function QueryParamsTable() {
	return (
		<DocsTable
			caption="Tham số query của route danh sách"
			headers={["Tham số", "Tác dụng", "Ví dụ"]}
			rows={ROWS}
			data-id="docs-query-params"
		/>
	);
}
