import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useUnlockVault, useVaultUi } from "./use-vault-ui";
import {
	type VariableRow,
	currentValue,
	draftsOf,
	lockedKeysOf,
	mergedLocal,
	rowsOf,
} from "./variable-rows";

const MASK = "••••••••";

/** A value locked in the vault: a send using it stops until unlocked. */
function LockedValue({ name }: { name: string }) {
	const t = useT();
	const unlock = useUnlockVault();
	return (
		<span className="flex min-w-0 items-center gap-1">
			<Badge tone="warning" data-id="vars-quick-locked">
				{t("agentUse.vault.badge")}
			</Badge>
			<Button
				size="sm"
				variant="ghost"
				aria-haspopup="dialog"
				aria-label={t("agentUse.vault.cell.lockedLabel", { name })}
				data-id="vars-quick-unlock"
				onClick={() => unlock()}
			>
				{t("agentUse.vault.unlock")}
			</Button>
		</span>
	);
}

/** One variable: name, the value in use (masked for a secret), its source. */
function PaneRow({ row, vaultUi }: { row: VariableRow; vaultUi: boolean }) {
	const t = useT();
	const [revealed, setRevealed] = useState(false);
	const { variable } = row;
	const value = currentValue(row);
	const secret = variable.type === "secret";
	const withheld = row.local === undefined && variable.sharedHidden;
	const locked = vaultUi && row.locked === true;
	let shown: ReactNode;
	if (!variable.enabled) {
		shown = <i className="text-muted">{t("environments.quick.off")}</i>;
	} else if (locked) {
		shown = <LockedValue name={variable.key} />;
	} else if (withheld) {
		shown = <Badge tone="neutral">{t("environments.table.hidden")}</Badge>;
	} else if (value === null) {
		shown = (
			<span className="text-muted">{t("environments.table.notShared")}</span>
		);
	} else {
		shown = secret && !revealed ? MASK : value;
	}
	return (
		<li
			data-id="vars-quick-row"
			data-key={variable.key}
			className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2 py-1 text-xs"
		>
			<code className="truncate font-mono" title={variable.key}>
				{variable.key}
			</code>
			<span className="flex min-w-0 items-center gap-1 font-mono">
				<span className="min-w-0 truncate" data-id="vars-quick-value">
					{shown}
				</span>
				{secret &&
				variable.enabled &&
				!withheld &&
				!locked &&
				value !== null ? (
					<IconButton
						size="sm"
						variant="ghost"
						data-id="vars-quick-reveal"
						aria-pressed={revealed}
						label={t(
							revealed
								? "environments.quick.hide"
								: "environments.quick.reveal",
							{ name: variable.key },
						)}
						icon={
							revealed ? (
								<IconEyeOff size={14} aria-hidden="true" />
							) : (
								<IconEye size={14} aria-hidden="true" />
							)
						}
						onClick={() => setRevealed((on) => !on)}
					/>
				) : null}
			</span>
			<Badge tone="neutral">
				{t(
					row.local === undefined
						? "environments.quick.source.shared"
						: "environments.quick.source.local",
				)}
			</Badge>
		</li>
	);
}

export interface VariablesPaneSectionProps {
	"data-id": string;
	/** The scope's name, with its icon or color dot. */
	title: ReactNode;
	/** Accessible name of Edit ("Edit Staging") and its `data-id`. */
	editLabel?: string;
	editId?: string;
	onEdit?: () => void;
	/** The scope's variables; `undefined` while loading. */
	scope?: {
		variables: readonly VariableView[];
		localValues: readonly LocalValue[];
	};
	failed?: boolean;
	/** Shown instead of the list (no environment selected). */
	empty?: string;
}

/** A scope in the quick look: its title, Edit, and each variable's value in use. */
export function VariablesPaneSection(props: VariablesPaneSectionProps) {
	const t = useT();
	const { scope } = props;
	const vaultUi = useVaultUi() !== null;
	const rows = scope
		? rowsOf(
				draftsOf(scope.variables),
				mergedLocal(scope.localValues, {}),
				lockedKeysOf(scope.localValues),
			)
		: [];
	let body: ReactNode;
	if (props.empty)
		body = <p className="m-0 text-muted text-xs">{props.empty}</p>;
	else if (props.failed) {
		body = (
			<p className="m-0 text-error text-xs">
				{t("environments.quick.loadFailed")}
			</p>
		);
	} else if (!scope) {
		body = <Skeleton variant="text" lines={2} />;
	} else if (rows.length === 0) {
		body = (
			<p className="m-0 text-muted text-xs">{t("environments.quick.empty")}</p>
		);
	} else {
		body = (
			<ul className="m-0 grid list-none p-0">
				{rows.map((row) => (
					<PaneRow key={row.variable.rowId} row={row} vaultUi={vaultUi} />
				))}
			</ul>
		);
	}
	return (
		<section data-id={props["data-id"]} className="grid gap-1">
			<h3 className="m-0 flex min-h-8 items-center gap-2 font-bold font-mono text-sm">
				<span className="flex min-w-0 flex-1 items-center gap-2 truncate">
					{props.title}
				</span>
				{props.onEdit ? (
					<Button
						size="sm"
						variant="ghost"
						data-id={props.editId}
						aria-label={props.editLabel}
						onClick={props.onEdit}
					>
						{t("environments.quick.edit")}
					</Button>
				) : null}
			</h3>
			{body}
		</section>
	);
}
