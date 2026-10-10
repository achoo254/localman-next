import { useId } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { TunnelStatus } from "../upstream/tunnel-status";
import { type InboxDraft, type InboxErrors, wholeIn } from "./inbox-form-state";

export interface InboxForwardFieldsProps {
	draft: InboxDraft;
	errors: InboxErrors;
	onChange: <K extends keyof InboxDraft>(
		field: K,
		value: InboxDraft[K],
	) => void;
}

/** "Forward to your machine": switch, then port and path of the tunnel. */
export function InboxForwardFields({
	draft,
	errors,
	onChange,
}: InboxForwardFieldsProps) {
	const t = useT();
	const id = useId();
	const port = wholeIn(draft.port, 1, 65_535);
	return (
		<section className="grid gap-3" data-id="inbox-form-forward">
			<div className="flex items-start justify-between gap-3">
				<div className="grid gap-1">
					<h3 id={`${id}-label`} className="m-0 font-bold font-mono text-sm">
						{t("webhookInbox.form.forward")}
					</h3>
					<p id={`${id}-help`} className="m-0 text-muted text-sm">
						{t("webhookInbox.form.forwardHelp")}
					</p>
				</div>
				<Switch
					checked={draft.forward}
					onCheckedChange={(checked) => onChange("forward", checked)}
					aria-labelledby={`${id}-label`}
					aria-describedby={`${id}-help`}
					data-id="inbox-form-forward-toggle"
				/>
			</div>
			{draft.forward ? (
				<>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
						<FormField label={t("webhookInbox.form.port")} error={errors.port}>
							<Input
								type="number"
								inputMode="numeric"
								min={1}
								max={65_535}
								value={draft.port}
								onChange={(event) => onChange("port", event.target.value)}
								data-id="inbox-form-forward-port"
							/>
						</FormField>
						<FormField label={t("webhookInbox.form.path")} error={errors.path}>
							<Input
								value={draft.path}
								spellCheck={false}
								autoComplete="off"
								onChange={(event) => onChange("path", event.target.value)}
								data-id="inbox-form-forward-path"
							/>
						</FormField>
					</div>
					<p
						className="m-0 text-muted text-sm wrap-anywhere"
						data-id="inbox-form-forward-target"
					>
						{renderRich(
							t("webhookInbox.form.target", {
								target: `tunnel:${draft.port}${draft.path}`,
							}),
						)}
					</p>
					{port === null ? null : (
						// The server checks the tunnel once the inbox is saved.
						<TunnelStatus port={port} url={undefined} scope="inbox-form" />
					)}
				</>
			) : null}
		</section>
	);
}
