import type { VariableEntry } from "@localman/shared/api-client";
import { IconX } from "@tabler/icons-react";
import { useRef } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { controlClassName } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LocalValueCell } from "./local-value-cell";
import type { CollectionLocal } from "./use-collection-local";

export const VARIABLE_CELL =
	"border-border-subtle border-b px-1 py-1 align-middle";
const FIELD = cn(controlClassName, "min-h-9 px-2 text-xs");

export interface CollectionVariableRowProps {
	variable: VariableEntry;
	index: number;
	canEdit: boolean;
	/** The caller's own values (environments on), else `null`. */
	local: CollectionLocal | null;
	onChange: (patch: Partial<VariableEntry>) => void;
	onRemove: () => void;
}

/**
 * One collection variable: on, key, the caller's own value (environments
 * on), shared value, secret, remove. Renaming the key moves the caller's
 * own value to the new name, as an environment's table does.
 */
export function CollectionVariableRow(props: CollectionVariableRowProps) {
	const t = useT();
	const { variable: v, index, canEdit, local } = props;
	const keyAtFocus = useRef("");
	const name = v.key.trim() || t("apiClient.table.rowN", { n: index + 1 });
	const sharedLabel = local
		? "environments.table.sharedOf"
		: "collections.page.variables.valueOf";
	return (
		<tr data-id="collection-variable">
			<td className={VARIABLE_CELL}>
				<input
					type="checkbox"
					checked={v.enabled !== false}
					disabled={!canEdit}
					aria-label={t("collections.page.variables.enable", { name })}
					className="size-4 accent-(--c-primary)"
					onChange={(e) => props.onChange({ enabled: e.target.checked })}
				/>
			</td>
			<td className={VARIABLE_CELL}>
				<input
					type="text"
					value={v.key}
					readOnly={!canEdit}
					aria-label={t("collections.page.variables.keyOf", { n: index + 1 })}
					className={FIELD}
					onFocus={() => {
						keyAtFocus.current = v.key.trim();
					}}
					onBlur={(e) => local?.move(keyAtFocus.current, e.target.value.trim())}
					onChange={(e) => props.onChange({ key: e.target.value })}
				/>
			</td>
			{local ? (
				<LocalValueCell
					entry={v}
					label={name}
					value={local.valueOf(v.key.trim())}
					ready={local.ready}
					className={VARIABLE_CELL}
					onSave={(value) => local.save(v.key.trim(), value)}
				/>
			) : null}
			<td className={VARIABLE_CELL}>
				<input
					type={v.secret ? "password" : "text"}
					autoComplete="off"
					value={v.value}
					readOnly={!canEdit}
					aria-label={t(sharedLabel, { name })}
					className={FIELD}
					onChange={(e) => props.onChange({ value: e.target.value })}
				/>
			</td>
			<td className={VARIABLE_CELL}>
				<input
					type="checkbox"
					checked={v.secret === true}
					disabled={!canEdit}
					aria-label={t("collections.page.variables.markSecret", { name })}
					className="size-4 accent-(--c-primary)"
					onChange={(e) => props.onChange({ secret: e.target.checked })}
				/>
			</td>
			<td className={VARIABLE_CELL}>
				{canEdit ? (
					<IconButton
						size="sm"
						label={t("collections.page.variables.remove", { name })}
						icon={<IconX size={14} aria-hidden="true" />}
						onClick={props.onRemove}
					/>
				) : null}
			</td>
		</tr>
	);
}
