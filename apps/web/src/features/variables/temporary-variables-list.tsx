import { IconX } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";

/**
 * The open tab's temporary variables, read-only, each with a button that
 * removes it; for the Variables pane. Values are shown as set: a
 * temporary variable is never secret.
 */
export function TemporaryVariablesList() {
	const t = useT();
	const { activeTab } = useWorkbenchState();
	const { setTemporaryVariable } = useWorkbenchActions();
	const variables = activeTab?.temporary ?? [];

	return (
		<section data-id="vars-quick-temp" className="grid gap-2">
			<h4 className="m-0 font-mono font-semibold text-sm">
				{t("variables.temporary.title")}
			</h4>
			<p className="m-0 text-muted text-xs">{t("variables.temporary.note")}</p>
			{activeTab && variables.length > 0 ? (
				<ul
					aria-label={t("variables.temporary.caption")}
					className="m-0 grid list-none gap-1 p-0"
				>
					{variables.map((variable) => (
						<li
							key={variable.key}
							data-id="vars-quick-temp-item"
							className="flex min-h-9 items-center gap-2 rounded-sm border border-border-subtle px-2 font-mono text-xs"
						>
							<span className="min-w-0 shrink-0 truncate font-semibold">
								{variable.key}
							</span>
							<span className="min-w-0 flex-1 truncate text-muted">
								{variable.value}
							</span>
							<IconButton
								size="sm"
								icon={<IconX size={14} aria-hidden="true" />}
								label={t("variables.temporary.remove", { name: variable.key })}
								data-id="vars-quick-temp-remove"
								onClick={() =>
									setTemporaryVariable(activeTab.id, variable.key, null)
								}
							/>
						</li>
					))}
				</ul>
			) : (
				<p data-id="vars-quick-temp-empty" className="m-0 text-muted text-xs">
					{t("variables.temporary.empty")}
				</p>
			)}
		</section>
	);
}
