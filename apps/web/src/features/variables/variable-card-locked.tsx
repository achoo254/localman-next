import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { useUnlockVault } from "../environments/use-vault-ui";

export interface LockedVariableCardProps {
	name: string;
	/** Where the locked value comes from ("Environment · Staging"). */
	scope: string;
	/** Sealed by another vault: unlocking cannot help, no button. */
	unreadable: boolean;
	onDone: () => void;
}

/**
 * The hover card of a `{{name}}` won by the caller's own value while it is
 * locked in the vault: a send using it stops until the vault opens.
 */
export function LockedVariableCard({
	name,
	scope,
	unreadable,
	onDone,
}: LockedVariableCardProps) {
	const t = useT();
	const unlock = useUnlockVault();
	return (
		<div className="grid gap-2">
			<div className="flex items-center gap-2">
				<span className="min-w-0 truncate font-bold font-mono text-sm">
					{name}
				</span>
				<Badge tone="warning" className="ml-auto">
					<IconLock size={12} aria-hidden="true" />
					{t(
						unreadable
							? "variables.tooltip.unreadableValue"
							: "variables.tooltip.locked",
					)}
				</Badge>
			</div>
			<p data-id="var-tooltip-locked" className="m-0 text-muted text-xs">
				{renderRich(
					t(
						unreadable
							? "variables.tooltip.unreadableNote"
							: "variables.tooltip.lockedNote",
						{ scope, token: `{{${name}}}` },
					),
				)}
			</p>
			{unreadable ? null : (
				<div>
					<Button
						size="sm"
						variant="secondary"
						aria-haspopup="dialog"
						data-id="var-tooltip-unlock"
						onClick={() => {
							onDone();
							unlock();
						}}
					>
						<IconLockOpen size={14} aria-hidden="true" />
						{t("variables.tooltip.unlock")}
					</Button>
				</div>
			)}
		</div>
	);
}
