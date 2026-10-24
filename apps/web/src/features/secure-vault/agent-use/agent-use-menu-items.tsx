import { IconRobot, IconX } from "@tabler/icons-react";
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "../../../components/ui/dropdown-menu";
import { useT } from "../../../i18n/i18n-context";
import {
	type AgentUseScope,
	type AgentUseSubject,
	agentHasValue,
	agentNeedsVault,
} from "./agent-use-types";

const META = "ml-auto pl-3 text-muted text-xs";

/**
 * "Let agents use…" (off), or "Edit hosts for agents" and "Stop letting
 * agents use" (on), first in a secret row's menu. With a local value and
 * the vault closed, those needing the value stay visible but disabled,
 * saying why; stopping always works.
 */
export function AgentUseMenuItems({
	scope,
	subject,
}: {
	scope: AgentUseScope;
	subject: AgentUseSubject;
}) {
	const t = useT();
	if (!agentHasValue(subject)) return null;
	const hosts = scope.hostsOf(subject.key);
	const gated = agentNeedsVault(subject, scope.vault);
	const hint = gated ? (
		<span className={META}>
			{t(
				scope.vault === "none"
					? "agentUse.vault.needCreate"
					: "agentUse.vault.needUnlock",
			)}
		</span>
	) : null;
	const icon = <IconRobot size={16} aria-hidden="true" />;
	if (hosts === undefined) {
		return (
			<>
				<DropdownMenuItem
					data-id="var-menu-agent"
					icon={icon}
					disabled={gated}
					onSelect={() => scope.open(subject)}
				>
					{t("agentUse.menu.enable")}
					{hint}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
			</>
		);
	}
	return (
		<>
			<DropdownMenuItem
				data-id="var-menu-agent-hosts"
				icon={icon}
				disabled={gated}
				onSelect={() => scope.open(subject)}
			>
				{t("agentUse.menu.edit")}
				{hint ?? (
					<span className={META}>
						{t("agentUse.menu.hosts", { count: hosts.length })}
					</span>
				)}
			</DropdownMenuItem>
			{/* Taking the use back needs no value, so it works with the vault locked. */}
			<DropdownMenuItem
				data-id="var-menu-agent-off"
				icon={<IconX size={16} aria-hidden="true" />}
				onSelect={() => scope.turnOff(subject)}
			>
				{t("agentUse.menu.off")}
			</DropdownMenuItem>
			<DropdownMenuSeparator />
		</>
	);
}
