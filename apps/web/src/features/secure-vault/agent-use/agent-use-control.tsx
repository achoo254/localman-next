import { IconRobot } from "@tabler/icons-react";
import { buttonClassName } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { agentHostsLabel } from "./agent-hosts";
import {
	type AgentUseScope,
	type AgentUseSubject,
	agentHasValue,
	agentNeedsVault,
} from "./agent-use-types";

export interface AgentUseControlProps {
	scope: AgentUseScope;
	subject: AgentUseSubject;
}

const CHIP =
	"tint-soft inline-flex min-h-8 max-w-44 cursor-pointer items-center gap-1 rounded-sm border px-2 font-mono text-(--tone-fg) text-xs [--tone-fg:var(--c-primary)] [--tone:var(--c-primary)] pointer-coarse:min-h-10";

/**
 * "Let agents use" of a secret row: a robot button while off, the hosts
 * ("api.example.com +2") while on. Either opens the dialog (hence a
 * button with a popup, not a toggle); its name says whether it is on. A
 * local value needs the vault open: the control then only says so.
 */
export function AgentUseControl({ scope, subject }: AgentUseControlProps) {
	const t = useT();
	const toast = useToast();
	if (!agentHasValue(subject)) return null;
	const hosts = scope.hostsOf(subject.key);
	const on = hosts !== undefined;
	const gated = agentNeedsVault(subject, scope.vault);
	const gate = t(
		scope.vault === "none"
			? "agentUse.control.gatedCreate"
			: "agentUse.control.gatedUnlock",
	);
	const list = hosts?.join(", ") ?? "";
	let title = t("agentUse.control.offTitle");
	if (gated) title = gate;
	else if (on)
		title = t("agentUse.control.onTitle", {
			name: subject.key,
			hosts: list,
		});
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			aria-disabled={gated || undefined}
			aria-label={
				on
					? t("agentUse.control.on", { name: subject.key, hosts: list })
					: t("agentUse.control.off", { name: subject.key })
			}
			title={title}
			data-id={on ? "var-table-agent-hosts" : "var-table-agent"}
			className={cn(
				on
					? CHIP
					: cn(
							buttonClassName({ variant: "ghost", size: "sm", iconOnly: true }),
							"size-8 pointer-coarse:size-10",
						),
				gated && "opacity-45",
			)}
			onClick={() => {
				if (gated) toast.show({ tone: "info", title: gate });
				else scope.open(subject);
			}}
		>
			<IconRobot size={on ? 12 : 16} aria-hidden="true" />
			{on ? <span className="truncate">{agentHostsLabel(hosts)}</span> : null}
		</button>
	);
}
