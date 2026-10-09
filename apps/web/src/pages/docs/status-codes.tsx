import {
	DEFAULT_JSON_LIMITS,
	MAX_JSON_BODY_KB,
	MAX_RECORDS_PER_RESOURCE,
	MAX_RECORD_BYTES,
	MAX_RESOURCE_BYTES,
	limitsFor,
} from "@localman/shared/constants";
import { Fragment, type ReactNode } from "react";
import { DocsTable, InlineCode } from "./docs-content";

const KB = 1024;
const number = new Intl.NumberFormat("vi-VN");

function Code({ code }: { code: string }) {
	return <InlineCode>{code}</InlineCode>;
}

const freeMonthly = limitsFor("free").mockRequestsPerMonth;

/** Empty "Mã" cell: screen readers say "Không có", not "dash". */
function NoCode() {
	return (
		<>
			<span aria-hidden="true">—</span>
			<span className="sr-only">Không có</span>
		</>
	);
}

const ROWS: readonly (readonly ReactNode[])[] = [
	["200", <NoCode key="c" />, "GET, PUT, PATCH và DELETE thành công."],
	[
		"201",
		<NoCode key="c" />,
		"POST đã tạo bản ghi; body là bản ghi mới kèm id.",
	],
	[
		"400",
		<Code key="c" code="INVALID_QUERY" />,
		<Fragment key="d">
			Tên tham số query bắt đầu bằng <InlineCode>$</InlineCode>, chứa{" "}
			<InlineCode>.</InlineCode>, <InlineCode>[</InlineCode> hoặc{" "}
			<InlineCode>]</InlineCode>, là <InlineCode>__proto__</InlineCode>,{" "}
			<InlineCode>constructor</InlineCode>, <InlineCode>prototype</InlineCode>,
			hoặc một tham số xuất hiện hai lần.
		</Fragment>,
	],
	[
		"400",
		<Code key="c" code="INVALID_JSON" />,
		<Fragment key="d">
			Body gửi kèm <InlineCode>Content-Type: application/json</InlineCode> nhưng
			không phải JSON hợp lệ.
		</Fragment>,
	],
	[
		"400",
		<Code key="c" code="VALIDATION_ERROR" />,
		<Fragment key="d">
			Body là JSON nhưng không phải object, chứa key{" "}
			<InlineCode>__proto__</InlineCode>, <InlineCode>constructor</InlineCode>{" "}
			hoặc <InlineCode>prototype</InlineCode>, hoặc{" "}
			<InlineCode>{"{parent}Id"}</InlineCode> không trỏ tới bản ghi cha có thật
			khi tạo bản ghi con qua route phẳng. Body lồng sâu hơn{" "}
			{DEFAULT_JSON_LIMITS.maxDepth} tầng hoặc có hơn{" "}
			{number.format(DEFAULT_JSON_LIMITS.maxNodes)} giá trị (mỗi object, mảng và
			giá trị đơn tính một) cũng bị từ chối với mã này.
		</Fragment>,
	],
	[
		"400",
		<Code key="c" code="BAD_REQUEST" />,
		"Request bị ngắt khi body chưa gửi xong, hoặc máy chủ không đọc được request.",
	],
	[
		"404",
		<Code key="c" code={'"Not found"'} />,
		<Fragment key="d">
			Sai secret (đúng định dạng), sai prefix, không có resource hoặc bản ghi
			đó, bản ghi cha trên route lồng không khớp, endpoint đang tắt, hoặc method
			không phục vụ route này (ví dụ POST lên <InlineCode>/:res/:id</InlineCode>
			). Body là đúng chuỗi JSON này.
		</Fragment>,
	],
	[
		"404",
		<Code key="c" code="NOT_FOUND" />,
		<Fragment key="d">
			Secret sai định dạng (chỉ nhận chữ thường, số và dấu gạch ngang, tối đa 63
			ký tự), nên request không trỏ tới project nào. Body theo dạng lỗi chung:{" "}
			<InlineCode>{'{ "error": { "code": "NOT_FOUND", … } }'}</InlineCode>.
		</Fragment>,
	],
	[
		"409",
		<Code key="c" code="RECORD_LIMIT_REACHED" />,
		`Resource đã có ${number.format(MAX_RECORDS_PER_RESOURCE)} bản ghi, mức tối đa.`,
	],
	[
		"413",
		<Code key="c" code="DATA_TOO_LARGE" />,
		`Một bản ghi vượt ${MAX_RECORD_BYTES / KB} KB, hoặc tổng dữ liệu của resource vượt ${MAX_RESOURCE_BYTES / KB / KB} MB.`,
	],
	[
		"413",
		<Code key="c" code="PAYLOAD_TOO_LARGE" />,
		`Body gửi lên lớn hơn ${MAX_JSON_BODY_KB} KB.`,
	],
	[
		"415",
		<Code key="c" code="UNSUPPORTED_MEDIA_TYPE" />,
		<Fragment key="d">
			Body dùng <InlineCode>Content-Encoding</InlineCode> hoặc charset mà máy
			chủ không đọc được; gửi JSON UTF-8 không nén.
		</Fragment>,
	],
	[
		"422",
		<Code key="c" code="RESPONSE_TOO_LARGE" />,
		<Fragment key="d">
			Body trả về sẽ vượt {MAX_RESOURCE_BYTES / KB / KB} MB; lấy ít bản ghi hơn
			bằng <InlineCode>limit</InlineCode>.
		</Fragment>,
	],
	[
		"429",
		<Code key="c" code="RATE_LIMITED" />,
		<Fragment key="d">
			Gửi quá nhanh (giới hạn theo IP và theo project). Chờ số giây trong header{" "}
			<InlineCode>Retry-After</InlineCode> rồi gửi lại.
		</Fragment>,
	],
	[
		"429",
		<Code key="c" code="MONTHLY_QUOTA_EXCEEDED" />,
		freeMonthly === null
			? "Chủ project đã dùng hết hạn mức request tháng."
			: `Chủ project đã dùng hết hạn mức request tháng (gói Free: ${number.format(freeMonthly)} request tới mock mỗi tháng, tính chung cho mọi project của họ).`,
	],
	[
		"500",
		<Code key="c" code="INTERNAL_ERROR" />,
		<Fragment key="d">
			Lỗi phía máy chủ. Gửi kèm <InlineCode>X-Localman-Request-Id</InlineCode>{" "}
			khi báo lỗi.
		</Fragment>,
	],
];

/** HTTP statuses and error codes of the mock runtime. */
export function StatusCodesTable() {
	return (
		<DocsTable
			caption="Mã trạng thái và mã lỗi"
			headers={["HTTP", "Mã", "Khi nào"]}
			rows={ROWS}
			data-id="docs-status-codes"
		/>
	);
}
