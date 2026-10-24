import { AGENT_HOSTS_MAX } from "@localman/shared/api-client";
import { brand } from "@localman/shared/brand";
import { IconRobot } from "@tabler/icons-react";
import type { QueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { Textarea } from "../../../components/ui/textarea";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import {
	type SuggestionSource,
	hostSuggestions,
	hostsSavable,
	parseAgentHosts,
	refusedLines,
} from "./agent-hosts";
import {
	AgentUseNotes,
	HostErrorList,
	HostSuggestionList,
} from "./agent-use-dialog-parts";
import { agentSaveFailure } from "./agent-use-errors";
import type { AgentUseSubject } from "./agent-use-types";
import { cachedHostSources } from "./cached-host-sources";

export interface AgentUseDialogProps {
	subject: AgentUseSubject;
	/** Current hosts; `undefined` when turning it on. */
	hosts: readonly string[] | undefined;
	own: readonly SuggestionSource[];
	client: QueryClient;
	turningOff: boolean;
	/** Rejects with the server's error; the dialog shows it. */
	onSave: (hosts: string[]) => Promise<void>;
	onTurnOff: () => void;
	onClose: () => void;
}

const appHost = (): string => window.location.hostname;

/**
 * Turns "Let agents use" on for one secret, or edits its hosts: one host
 * per line, checked as typed; hosts the server refuses go back onto
 * their line. Suggestions come from base-URL variables already loaded.
 */
export function AgentUseDialog(props: AgentUseDialogProps) {
	const t = useT();
	const { subject } = props;
	const editing = props.hosts !== undefined;
	// Read once, when the dialog opens.
	const [suggestions] = useState(() =>
		hostSuggestions(props.own, cachedHostSources(props.client), appHost()),
	);
	const [text, setText] = useState(
		() => props.hosts?.join("\n") ?? suggestions.prefill ?? "",
	);
	const [refused, setRefused] = useState<readonly string[]>([]);
	const [message, setMessage] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const area = useRef<HTMLTextAreaElement>(null);
	const ids = { help: useId(), errors: useId(), field: useId() };

	const parsed = parseAgentHosts(text, appHost());
	const refusedErrors = refusedLines(text, refused);
	const errors = [...parsed.errors, ...refusedErrors].sort(
		(a, b) => a.line - b.line,
	);
	const savable = hostsSavable(parsed) && refusedErrors.length === 0;

	const change = (next: string) => {
		setText(next);
		setMessage(null);
	};
	const add = (host: string) => {
		const kept = text.replace(/\s+$/, "");
		change(kept ? `${kept}\n${host}` : host);
		area.current?.focus();
	};
	const submit = async () => {
		if (!savable || saving) return;
		setSaving(true);
		try {
			await props.onSave(parsed.hosts);
			props.onClose();
		} catch (error) {
			const failure = agentSaveFailure(error);
			if (failure.kind === "refused") setRefused(failure.hosts);
			else setMessage(t(`agentUse.dialog.errors.${failure.reason}`));
		} finally {
			setSaving(false);
		}
	};
	const count =
		parsed.hosts.length > 0
			? t("agentUse.dialog.count", {
					count: parsed.hosts.length,
					max: AGENT_HOSTS_MAX,
				})
			: t("agentUse.dialog.needOne");
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) props.onClose();
			}}
			size="md"
			data-id="modal-var-agent"
			initialFocusRef={area}
			title={t(
				editing ? "agentUse.dialog.titleEdit" : "agentUse.dialog.titleEnable",
			)}
			footer={
				<ModalFooter>
					<Button variant="secondary" onClick={props.onClose}>
						{t("common.actions.cancel")}
					</Button>
					<Button
						variant="primary"
						data-id="modal-var-agent-confirm"
						disabled={!savable}
						loading={saving}
						onClick={() => void submit()}
					>
						{editing ? null : <IconRobot size={16} aria-hidden="true" />}
						{t(
							editing
								? "agentUse.dialog.submitEdit"
								: "agentUse.dialog.submitEnable",
						)}
					</Button>
				</ModalFooter>
			}
		>
			<p className="m-0 text-sm">
				{renderRich(
					t("agentUse.dialog.intro", { token: `{{${subject.key}}}` }),
				)}
			</p>
			<div className="grid gap-2">
				<label htmlFor={ids.field} className="font-semibold text-sm">
					{t("agentUse.dialog.hostsLabel")}
				</label>
				<Textarea
					ref={area}
					id={ids.field}
					rows={4}
					value={text}
					spellCheck={false}
					autoCapitalize="off"
					autoComplete="off"
					invalid={errors.length > 0 || parsed.tooMany}
					aria-describedby={`${ids.help} ${ids.errors}`}
					data-id="modal-var-agent-hosts"
					className="font-mono text-sm"
					onChange={(event) => change(event.target.value)}
				/>
				<HostErrorList
					id={ids.errors}
					errors={errors}
					tooMany={
						parsed.tooMany
							? t("agentUse.dialog.tooMany", { max: AGENT_HOSTS_MAX })
							: null
					}
					message={message}
				/>
				<p id={ids.help} className="m-0 text-muted text-xs">
					<span data-id="modal-var-agent-hosts-count">{count}</span>{" "}
					{renderRich(t("agentUse.dialog.help", { app: brand.appName }))}
				</p>
				<HostSuggestionList
					hosts={suggestions.all.slice(0, 6)}
					taken={parsed.hosts}
					onAdd={add}
				/>
			</div>
			<AgentUseNotes local={subject.hasLocal} />
			{editing ? (
				<Button
					variant="ghost"
					size="sm"
					className="justify-self-start"
					data-id="modal-var-agent-off"
					loading={props.turningOff}
					onClick={props.onTurnOff}
				>
					{t("agentUse.dialog.turnOff")}
				</Button>
			) : null}
		</Modal>
	);
}
