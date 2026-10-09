import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { autoHeaders } from "./auto-headers";
import type { DraftPaneProps } from "./draft-pane";
import { newKeyValueRow } from "./draft-pane";
import { KeyValueTable } from "./key-value-table";

const CELL = "border-border-subtle border-b px-2 py-2 align-middle";

/** Headers typed by the user, with the ones added on send shown on demand. */
export function HeadersTab({ draft, update }: DraftPaneProps) {
	const t = useT();
	const [showAuto, setShowAuto] = useState(false);
	const auto = autoHeaders(draft);
	const autoRows = showAuto
		? auto.map((header) => (
				<tr
					key={`${header.source}-${header.name}`}
					data-id="request-headers-auto"
					className="text-muted"
				>
					<td className={`${CELL} text-center`}>
						<IconLock size={12} aria-hidden="true" className="inline" />
					</td>
					<td className={`${CELL} font-mono text-xs`}>{header.name}</td>
					<td className={`${CELL} break-all font-mono text-xs`}>
						{header.value}
					</td>
					<td className={`${CELL} text-xs max-md:hidden`}>
						{t(`apiClient.headers.source.${header.source}`)}
					</td>
					<td className={CELL} />
				</tr>
			))
		: null;
	return (
		<div className="grid gap-2">
			<div>
				<Button
					variant="ghost"
					size="sm"
					aria-pressed={showAuto}
					data-id="request-headers-toggle-auto"
					onClick={() => setShowAuto((shown) => !shown)}
				>
					{showAuto ? (
						<IconEyeOff size={14} aria-hidden="true" />
					) : (
						<IconEye size={14} aria-hidden="true" />
					)}
					{t("apiClient.headers.toggleAuto", { count: auto.length })}
				</Button>
			</div>
			<KeyValueTable
				rows={draft.headers}
				onChange={(headers) => update((current) => ({ ...current, headers }))}
				createRow={newKeyValueRow}
				dataId="request-headers"
				caption={t("apiClient.request.tabs.headers")}
				addLabel={t("apiClient.headers.add")}
				withDescription
				before={autoRows}
			/>
		</div>
	);
}
