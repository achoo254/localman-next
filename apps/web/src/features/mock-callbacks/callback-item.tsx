import { IconSend, IconX } from "@tabler/icons-react";
import { useId } from "react";
import { Button } from "../../components/ui/button";
import { CodeEditor } from "../../components/ui/code-editor";
import { FormField } from "../../components/ui/form-field";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../lib/method-tone";
import { TunnelStatus } from "../upstream/tunnel-status";
import { type CallbackDraft, parseTargetText } from "./callback-draft";
import { CallbackHeaders } from "./callback-headers";
import { CallbackResult } from "./callback-result";
import type { CallbackErrors } from "./callback-validation";
import { CALLBACK_EVENTS } from "./callbacks-api";
import { missedTunnel } from "./delivery";
import { useCallbackTest } from "./use-callback-test";

export interface CallbackItemProps {
	projectId: string;
	resourceId: string;
	index: number;
	draft: CallbackDraft;
	errors: CallbackErrors | undefined;
	manage: boolean;
	onChange: <K extends keyof CallbackDraft>(
		field: K,
		value: CallbackDraft[K],
	) => void;
	onRemove: () => void;
	onErrors: (errors: CallbackErrors) => void;
}

/**
 * One callback: on/off, event, target, body template, headers, "Send
 * test" and the last result. A disabled callback stays editable, dimmed.
 */
export function CallbackItem({
	projectId,
	resourceId,
	index,
	draft,
	errors,
	manage,
	onChange,
	onRemove,
	onErrors,
}: CallbackItemProps) {
	const t = useT();
	const id = useId();
	const test = useCallbackTest(projectId, resourceId, onErrors);
	const n = String(index + 1);
	const parsed = parseTargetText(draft.target);
	const port =
		parsed.ok && parsed.target.kind === "tunnel" ? parsed.target.port : null;
	const sending = test.state.status === "sending";
	return (
		<div
			data-id={`resource-form-callback-${n}`}
			data-callback={draft.key}
			className="grid gap-3 rounded-md border border-border-subtle p-3"
		>
			<div className="flex flex-wrap items-center gap-2">
				<Switch
					checked={draft.enabled}
					onCheckedChange={(enabled) => onChange("enabled", enabled)}
					aria-label={t("mockCallbacks.item.enable", { n })}
					disabled={!manage}
					data-id="resource-form-callback-toggle"
				/>
				<span
					className={cn(
						"font-mono font-semibold text-xs",
						METHOD_TEXT_CLASS.POST,
					)}
				>
					POST
				</span>
				<span className="text-muted text-sm">{t("mockCallbacks.item.on")}</span>
				<Select
					value={draft.on}
					aria-label={t("mockCallbacks.item.event", { n })}
					disabled={!manage}
					className="min-h-9 w-auto"
					onChange={(event) => {
						const value = CALLBACK_EVENTS.find(
							(item) => item === event.target.value,
						);
						if (value) onChange("on", value);
					}}
					data-id="resource-form-callback-event"
				>
					{CALLBACK_EVENTS.map((event) => (
						<option key={event} value={event}>
							{event}
						</option>
					))}
				</Select>
				{manage ? (
					<IconButton
						className="ml-auto"
						label={t("mockCallbacks.item.remove", { n })}
						icon={<IconX size={16} aria-hidden="true" />}
						onClick={onRemove}
						data-id="resource-form-callback-remove"
					/>
				) : null}
			</div>
			<div className={cn("grid gap-3", draft.enabled ? null : "opacity-55")}>
				<FormField
					label={t("mockCallbacks.item.target")}
					error={errors?.target}
				>
					<Input
						value={draft.target}
						placeholder={t("mockCallbacks.item.targetPlaceholder")}
						autoComplete="off"
						spellCheck={false}
						disabled={!manage}
						onChange={(event) => onChange("target", event.target.value)}
						data-id="resource-form-callback-target"
					/>
				</FormField>
				{port !== null && missedTunnel(draft.last) ? (
					<TunnelStatus port={port} url={null} scope="resource-form-callback" />
				) : null}
				<div className="grid gap-1.5">
					<span
						id={`${id}-body`}
						className="font-mono font-semibold text-[0.8125rem]"
					>
						{t("mockCallbacks.item.body")}
					</span>
					<CodeEditor
						value={draft.bodyTemplate}
						onChange={(body) => onChange("bodyTemplate", body)}
						language="json"
						labelledBy={`${id}-body`}
						describedBy={errors?.body ? `${id}-body-error` : undefined}
						readOnly={!manage}
						className="min-h-20"
						data-id="resource-form-callback-body"
					/>
					{errors?.body ? (
						<p
							id={`${id}-body-error`}
							className="m-0 text-[0.8125rem] text-error"
						>
							{errors.body}
						</p>
					) : null}
				</div>
				<CallbackHeaders
					headers={draft.headers}
					onChange={(headers) => onChange("headers", headers)}
					manage={manage}
					error={errors?.headers}
					rowErrors={errors?.headerRows}
				/>
			</div>
			{manage ? (
				<div>
					<Button
						size="sm"
						loading={sending}
						leadingIcon={<IconSend size={16} aria-hidden="true" />}
						onClick={() => void test.run(draft)}
						data-id="resource-form-callback-test"
					>
						{t("mockCallbacks.test.send")}
					</Button>
				</div>
			) : null}
			<CallbackResult last={draft.last} test={test.state} />
		</div>
	);
}
