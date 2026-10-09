import {
	MAX_TIMEOUT_MS,
	MIN_TIMEOUT_MS,
	type RequestSettings,
} from "@localman/shared/api-client";
import { type ReactNode, useEffect, useId, useState } from "react";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import { useT } from "../../../i18n/i18n-context";
import type { DraftPaneProps } from "./draft-pane";

function Row({
	title,
	hint,
	control,
}: { title: ReactNode; hint: string; control: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-border-subtle border-b py-3">
			<div className="grid min-w-0 gap-1">
				{title}
				<p className="text-muted text-xs">{hint}</p>
			</div>
			<div className="flex-none">{control}</div>
		</div>
	);
}

/** Whole milliseconds within the proxy's bounds; `null` for non-numbers. */
export function clampTimeout(text: string): number | null {
	const value = Number(text);
	if (text.trim() === "" || !Number.isFinite(value)) return null;
	return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(value)));
}

/** Per-request options: client IP forwarding, redirects, timeout. */
export function RequestSettingsTab({ draft, update }: DraftPaneProps) {
	const t = useT();
	const ids = { ip: useId(), follow: useId(), timeout: useId() };
	const { settings } = draft;
	const [timeout, setTimeoutText] = useState(String(settings.timeoutMs));
	useEffect(
		() => setTimeoutText(String(settings.timeoutMs)),
		[settings.timeoutMs],
	);
	const set = (change: Partial<RequestSettings>) =>
		update((current) => ({
			...current,
			settings: { ...current.settings, ...change },
		}));

	return (
		<div className="max-w-3xl">
			<Row
				title={
					<strong id={ids.ip} className="text-sm">
						{t("apiClient.settings.sendIp")}
					</strong>
				}
				hint={t("apiClient.settings.sendIpHint")}
				control={
					<Switch
						checked={settings.sendClientIp}
						aria-labelledby={ids.ip}
						data-id="request-settings-send-ip"
						onCheckedChange={(sendClientIp) => set({ sendClientIp })}
					/>
				}
			/>
			<Row
				title={
					<strong id={ids.follow} className="text-sm">
						{t("apiClient.settings.follow")}
					</strong>
				}
				hint={t("apiClient.settings.followHint")}
				control={
					<Switch
						checked={settings.followRedirects}
						aria-labelledby={ids.follow}
						data-id="request-settings-follow"
						onCheckedChange={(followRedirects) => set({ followRedirects })}
					/>
				}
			/>
			<Row
				title={
					<label htmlFor={ids.timeout} className="font-semibold text-sm">
						{t("apiClient.settings.timeout")}
					</label>
				}
				hint={t("apiClient.settings.timeoutHint", {
					min: MIN_TIMEOUT_MS,
					max: MAX_TIMEOUT_MS,
				})}
				control={
					<Input
						id={ids.timeout}
						type="number"
						inputMode="numeric"
						min={MIN_TIMEOUT_MS}
						max={MAX_TIMEOUT_MS}
						step={1000}
						value={timeout}
						className="w-32"
						data-id="request-settings-timeout"
						onChange={(event) => setTimeoutText(event.target.value)}
						onBlur={() => {
							const timeoutMs = clampTimeout(timeout) ?? settings.timeoutMs;
							setTimeoutText(String(timeoutMs));
							if (timeoutMs !== settings.timeoutMs) set({ timeoutMs });
						}}
					/>
				}
			/>
		</div>
	);
}
