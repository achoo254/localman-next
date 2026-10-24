import { brand } from "@localman/shared/brand";
import { IconPlus } from "@tabler/icons-react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import type { HostLineError, HostProblem } from "./agent-hosts";

function useProblemText(): (problem: HostProblem) => string {
	const t = useT();
	return (problem) => {
		switch (problem.kind) {
			case "duplicate":
				return t("agentUse.dialog.problems.duplicate", { line: problem.line });
			case "app":
				return t("agentUse.dialog.problems.app", { app: brand.appName });
			default:
				return t(`agentUse.dialog.problems.${problem.kind}`);
		}
	};
}

export interface HostErrorListProps {
	id: string;
	errors: readonly HostLineError[];
	/** "At most 20 hosts" when set. */
	tooMany: string | null;
	/** A failure that is not about one line. */
	message: string | null;
}

/** Errors under the hosts box, one per line, read out as they change. */
export function HostErrorList({
	id,
	errors,
	tooMany,
	message,
}: HostErrorListProps) {
	const t = useT();
	const problemText = useProblemText();
	return (
		<ul
			id={id}
			aria-live="polite"
			data-id="modal-var-agent-hosts-error"
			className="m-0 grid list-none gap-1 p-0 text-error-text text-xs empty:hidden"
		>
			{errors.map((error) => (
				<li key={error.line}>
					{t("agentUse.dialog.lineError", {
						line: error.line,
						host: error.host,
						reason: problemText(error.problem),
					})}
				</li>
			))}
			{tooMany ? <li>{tooMany}</li> : null}
			{message ? <li>{message}</li> : null}
		</ul>
	);
}

export interface HostSuggestionListProps {
	hosts: readonly string[];
	/** Hosts already listed (their button is off). */
	taken: readonly string[];
	onAdd: (host: string) => void;
}

/** Hosts read from base-URL variables, added with one click. */
export function HostSuggestionList({
	hosts,
	taken,
	onAdd,
}: HostSuggestionListProps) {
	const t = useT();
	if (hosts.length === 0) return null;
	return (
		<fieldset
			data-id="modal-var-agent-suggestions"
			className="m-0 min-w-0 border-0 p-0"
		>
			<legend className="sr-only">
				{t("agentUse.dialog.suggestionsLabel")}
			</legend>
			<div className="flex flex-wrap items-center gap-2">
				<span aria-hidden="true" className="text-muted text-xs">
					{t("agentUse.dialog.suggested")}
				</span>
				{hosts.map((host) => (
					<Button
						key={host}
						size="sm"
						variant="secondary"
						data-id="modal-var-agent-suggest"
						aria-label={t("agentUse.dialog.addHost", { host })}
						disabled={taken.includes(host)}
						onClick={() => onAdd(host)}
					>
						<IconPlus size={12} aria-hidden="true" />
						{host}
					</Button>
				))}
			</div>
		</fieldset>
	);
}

/**
 * What turning it on means: for a local value, that the server keeps a
 * copy; for a shared one, that it is for the caller's agents only. Then
 * the limits that hold either way.
 */
export function AgentUseNotes({ local }: { local: boolean }) {
	const t = useT();
	return (
		<div className="grid gap-3">
			{local ? (
				<Alert
					tone="warning"
					data-id="modal-var-agent-note"
					title={t("agentUse.dialog.localTitle")}
				>
					<span className="text-sm">{t("agentUse.dialog.localBody")}</span>
				</Alert>
			) : (
				<Alert
					tone="info"
					data-id="modal-var-agent-note"
					title={t("agentUse.dialog.sharedTitle")}
				>
					<span className="text-sm">{t("agentUse.dialog.sharedBody")}</span>
				</Alert>
			)}
			<ul
				aria-label={t("agentUse.dialog.factsLabel")}
				data-id="modal-var-agent-facts"
				className="m-0 grid list-disc gap-1 pl-6 text-muted text-sm"
			>
				<li>{t("agentUse.dialog.factOutside")}</li>
				<li>{t("agentUse.dialog.factRedirect")}</li>
				<li>{t("agentUse.dialog.factOnlyYou")}</li>
			</ul>
		</div>
	);
}
