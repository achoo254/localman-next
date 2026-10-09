import type { HeaderEntry } from "@localman/shared/api-client";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import type { SendRoute } from "../workbench/workbench-types";

export interface ResponseHeadersTableProps {
	headers: readonly HeaderEntry[];
	route: SendRoute;
}

export const CELL =
	"border-border-subtle border-b px-2 py-2 text-left align-top font-mono text-xs";

/** Response headers in arrival order, repeated names kept. */
export function ResponseHeadersTable({
	headers,
	route,
}: ResponseHeadersTableProps) {
	const t = useT();
	return (
		<div className="grid gap-3 p-4">
			{headers.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("apiClientTools.response.headers.empty")}
				</p>
			) : (
				<table data-id="response-headers" className="w-full border-collapse">
					<thead>
						<tr>
							<th scope="col" className={`${CELL} w-1/3 text-muted`}>
								{t("apiClientTools.response.headers.name")}
							</th>
							<th scope="col" className={`${CELL} text-muted`}>
								{t("apiClientTools.response.headers.value")}
							</th>
						</tr>
					</thead>
					<tbody>
						{headers.map((header, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: names repeat; the list is a snapshot.
							<tr key={index}>
								<td className={`${CELL} font-semibold`}>{header.name}</td>
								<td className={`${CELL} break-all`}>{header.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			<p data-id="response-headers-note" className="m-0 text-muted text-xs">
				{renderRich(
					route === "direct"
						? t("apiClientTools.response.headers.directNote")
						: t("apiClientTools.response.headers.proxyNote"),
				)}
			</p>
		</div>
	);
}
