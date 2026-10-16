import { urlWithParams } from "@localman/shared/api-client";
import { useT } from "../../../i18n/i18n-context";
import type { DraftPaneProps } from "./draft-pane";
import { newKeyValueRow } from "./draft-pane";
import { useInlineCommenting } from "./inline-comment-context";
import { KeyValueTable } from "./key-value-table";

/** Query params, kept in step with the URL's query string. */
export function ParamsTab({ draft, update }: DraftPaneProps) {
	const t = useT();
	const commenting = useInlineCommenting();
	return (
		<div className="grid gap-2" data-comment-part="params">
			<KeyValueTable
				rows={draft.params}
				onChange={(params) =>
					update((current) => ({
						...current,
						params,
						url: urlWithParams(current.url, params),
					}))
				}
				createRow={newKeyValueRow}
				dataId="request-params"
				caption={t("apiClient.request.tabs.params")}
				addLabel={t("apiClient.params.add")}
				withDescription
				rowExtra={(row) => commenting?.rowMarker("params", row.id)}
			/>
			<p className="text-muted text-xs">
				{t("apiClient.params.hint", { variable: "{{name}}" })}
			</p>
		</div>
	);
}
