import {
	MAX_PAGE_LIMIT,
	MOCK_QUERY_PARAMS as QUERY_PARAM_ALIASES,
} from "@localman/shared/constants";
import type { ReactNode } from "react";
import { useT } from "../../i18n/i18n-context";
import { DocsTable, InlineCode, Prose, docsRich } from "./docs-content";

/** How the docs write the `{parent}Id` column of a nested resource. */
export const PARENT_ID = "{parent}Id";

function Names({ names }: { names: readonly string[] }) {
	return (
		<span className="flex flex-wrap gap-1">
			{names.map((name) => (
				<InlineCode key={name}>{name}</InlineCode>
			))}
		</span>
	);
}

/** Every reserved name, in the order the table lists them. */
const RESERVED_NAMES: readonly string[] =
	Object.values(QUERY_PARAM_ALIASES).flat();

/**
 * A schema field named like a reserved parameter is read as that
 * parameter, so it cannot be used as a filter.
 */
export function ReservedParamsNote() {
	const t = useT();
	const names = RESERVED_NAMES.map((name) => `<code>${name}</code>`).join(", ");
	return (
		<Prose>
			{docsRich(t("docs.reference.queryParams.reserved", { names }))}
		</Prose>
	);
}

/** Query parameters of `GET /:res`, rendered from the alias lists. */
export function QueryParamsTable() {
	const t = useT();
	const example = (query: string) => <InlineCode key="e">{query}</InlineCode>;
	const rows: readonly (readonly ReactNode[])[] = [
		[
			<Names key="n" names={QUERY_PARAM_ALIASES.search} />,
			docsRich(t("docs.reference.queryParams.search")),
			example("?search=lan"),
		],
		[
			<Names key="n" names={["<field>"]} />,
			docsRich(t("docs.reference.queryParams.field", { parentId: PARENT_ID })),
			example("?paid=false"),
		],
		[
			<Names key="n" names={QUERY_PARAM_ALIASES.page} />,
			docsRich(t("docs.reference.queryParams.page")),
			example("?page=2&limit=10"),
		],
		[
			<Names key="n" names={QUERY_PARAM_ALIASES.limit} />,
			t("docs.reference.queryParams.limit", { max: MAX_PAGE_LIMIT }),
			example("?l=20"),
		],
		[
			<Names key="n" names={QUERY_PARAM_ALIASES.sort} />,
			docsRich(t("docs.reference.queryParams.sort")),
			example("?sortBy=createdAt"),
		],
		[
			<Names key="n" names={QUERY_PARAM_ALIASES.order} />,
			docsRich(t("docs.reference.queryParams.order")),
			example("?order=desc"),
		],
	];
	return (
		<DocsTable
			caption={t("docs.reference.queryParams.caption")}
			headers={[
				t("docs.reference.queryParams.headerParam"),
				t("docs.reference.queryParams.headerEffect"),
				t("docs.reference.queryParams.headerExample"),
			]}
			rows={rows}
			data-id="docs-query-params"
		/>
	);
}
