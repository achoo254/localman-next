import {
	DEFAULT_JSON_LIMITS,
	MAX_JSON_BODY_KB,
	MAX_RECORDS_PER_RESOURCE,
	MAX_RECORD_BYTES,
	MAX_RESOURCE_BYTES,
	limitsFor,
} from "@localman/shared/constants";
import type { ReactNode } from "react";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { DocsTable, InlineCode, docsRich } from "./docs-content";
import { PARENT_ID } from "./query-params";

const KB = 1024;
const freeMonthly = limitsFor("free").mockRequestsPerMonth;
const NOT_FOUND_BODY = '{ "error": { "code": "NOT_FOUND", … } }';

function Code({ code }: { code: string }) {
	return <InlineCode>{code}</InlineCode>;
}

/** Empty "Code" cell: screen readers say "None", not "dash". */
function NoCode({ label }: { label: string }) {
	return (
		<>
			<span aria-hidden="true">—</span>
			<span className="sr-only">{label}</span>
		</>
	);
}

type StatusRow = [string, string | null, ReactNode];

/** Errors a mock answers only when its endpoint's chaos says so. */
function chaosRows(t: Translate): StatusRow[] {
	return [
		[
			"4xx, 5xx",
			"MOCK_CHAOS_ERROR",
			t("docs.reference.statusCodes.chaosError"),
		],
		["504", "MOCK_TIMEOUT", t("docs.reference.statusCodes.chaosTimeout")],
		[
			"499",
			"REQUEST_CANCELLED",
			t("docs.reference.statusCodes.requestCancelled"),
		],
	];
}

/** [HTTP status, error code (null: none), explanation] in table order. */
function statusRows(t: Translate, chaos: boolean): StatusRow[] {
	return [
		["200", null, t("docs.reference.statusCodes.ok")],
		["201", null, t("docs.reference.statusCodes.created")],
		[
			"400",
			"INVALID_QUERY",
			docsRich(t("docs.reference.statusCodes.invalidQuery")),
		],
		[
			"400",
			"INVALID_JSON",
			docsRich(t("docs.reference.statusCodes.invalidJson")),
		],
		[
			"400",
			"VALIDATION_ERROR",
			docsRich(
				t("docs.reference.statusCodes.validation", {
					parentId: PARENT_ID,
					depth: DEFAULT_JSON_LIMITS.maxDepth,
					nodes: DEFAULT_JSON_LIMITS.maxNodes,
				}),
			),
		],
		["400", "BAD_REQUEST", t("docs.reference.statusCodes.badRequest")],
		[
			"401",
			"UNAUTHENTICATED",
			docsRich(t("docs.reference.statusCodes.unauthenticated")),
		],
		[
			"404",
			'"Not found"',
			docsRich(t("docs.reference.statusCodes.notFoundText")),
		],
		[
			"404",
			"NOT_FOUND",
			docsRich(
				t("docs.reference.statusCodes.notFoundCode", {
					errorBody: NOT_FOUND_BODY,
				}),
			),
		],
		[
			"409",
			"RECORD_LIMIT_REACHED",
			t("docs.reference.statusCodes.recordLimit", {
				max: MAX_RECORDS_PER_RESOURCE,
			}),
		],
		[
			"413",
			"DATA_TOO_LARGE",
			t("docs.reference.statusCodes.dataTooLarge", {
				recordKb: MAX_RECORD_BYTES / KB,
				resourceMb: MAX_RESOURCE_BYTES / KB / KB,
			}),
		],
		[
			"413",
			"PAYLOAD_TOO_LARGE",
			t("docs.reference.statusCodes.payloadTooLarge", { kb: MAX_JSON_BODY_KB }),
		],
		[
			"415",
			"UNSUPPORTED_MEDIA_TYPE",
			docsRich(t("docs.reference.statusCodes.unsupportedMediaType")),
		],
		[
			"422",
			"RESPONSE_TOO_LARGE",
			docsRich(
				t("docs.reference.statusCodes.responseTooLarge", {
					mb: MAX_RESOURCE_BYTES / KB / KB,
				}),
			),
		],
		[
			"429",
			"RATE_LIMITED",
			docsRich(t("docs.reference.statusCodes.rateLimited")),
		],
		[
			"429",
			"MONTHLY_QUOTA_EXCEEDED",
			freeMonthly === null
				? t("docs.reference.statusCodes.monthlyQuota")
				: t("docs.reference.statusCodes.monthlyQuotaFree", {
						requests: freeMonthly,
					}),
		],
		[
			"500",
			"INTERNAL_ERROR",
			docsRich(t("docs.reference.statusCodes.internal")),
		],
		...(chaos ? chaosRows(t) : []),
	];
}

/** HTTP statuses and error codes of the mock runtime. */
export function StatusCodesTable() {
	const t = useT();
	const { mockPowerUps } = useFeatures();
	const none = t("docs.reference.statusCodes.none");
	const rows = statusRows(t, mockPowerUps).map(([status, code, when]) => [
		status,
		code ? <Code key="c" code={code} /> : <NoCode key="c" label={none} />,
		when,
	]);
	return (
		<DocsTable
			caption={t("docs.reference.statusCodes.caption")}
			headers={[
				"HTTP",
				t("docs.reference.statusCodes.headerCode"),
				t("docs.reference.statusCodes.headerWhen"),
			]}
			rows={rows}
			data-id="docs-status-codes"
		/>
	);
}
