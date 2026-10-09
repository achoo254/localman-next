import type { ClientResponse } from "@localman/shared/api-client";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { cn } from "../../../lib/cn";
import type { SendRoute } from "../workbench/workbench-types";

export interface TimingsPopoverProps {
	response: ClientResponse;
	route: SendRoute;
}

type Phase = "dns" | "connect" | "tls" | "ttfb" | "download";

/** Phases in order; download is what follows the first byte. */
function phases(response: ClientResponse): [Phase, number | null][] {
	const { dns, connect, tls, ttfb, total } = response.timings;
	const download = ttfb === null ? null : Math.max(0, total - ttfb);
	// TTFB counts from the start of the send; its own bar is the wait only.
	const before = (dns ?? 0) + (connect ?? 0) + (tls ?? 0);
	const wait = ttfb === null ? null : Math.max(0, ttfb - before);
	return [
		["dns", dns],
		["connect", connect],
		["tls", tls],
		["ttfb", wait],
		["download", download],
	];
}

const ms = (value: number): string => `${Math.round(value)} ms`;

/** Total time as a button; opens the per-phase breakdown below it. */
export function TimingsPopover({ response, route }: TimingsPopoverProps) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const wrapper = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const rows = phases(response);
	const limited =
		route === "direct" || rows.every(([, value]) => value === null);
	const total = Math.max(response.timings.total, 1);

	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent): void => {
			const target = event.target;
			if (target instanceof Node && wrapper.current?.contains(target)) return;
			setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [open]);

	let offset = 0;
	return (
		<div
			ref={wrapper}
			className="relative"
			onKeyDown={(event) => {
				if (event.key !== "Escape" || !open) return;
				event.stopPropagation();
				setOpen(false);
				button.current?.focus();
			}}
		>
			<button
				ref={button}
				type="button"
				data-id="response-time"
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={t("apiClientTools.response.meta.timeLabel", {
					ms: Math.round(response.timings.total),
				})}
				className="cursor-pointer rounded-sm border-0 bg-transparent p-0 font-mono text-fg text-xs underline decoration-dotted underline-offset-4 hover:text-primary"
				onClick={() => setOpen((value) => !value)}
			>
				{t("apiClientTools.response.meta.time", {
					ms: Math.round(response.timings.total),
				})}
			</button>
			<section
				id={panelId}
				aria-labelledby={`${panelId}-title`}
				data-id="response-timings"
				hidden={!open}
				className="absolute top-full right-0 z-50 mt-2 grid w-80 max-w-[calc(100vw-2rem)] gap-2 rounded-md border border-border bg-surface p-3 shadow-lg"
			>
				<h3 id={`${panelId}-title`} className="m-0 font-bold font-mono text-sm">
					{t("apiClientTools.response.timings.title")}
				</h3>
				{limited ? null : (
					<ul className="m-0 grid list-none gap-1.5 p-0">
						{rows.map(([phase, value]) => {
							const left = (offset / total) * 100;
							if (value !== null) offset += value;
							return (
								<li
									key={phase}
									className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2"
								>
									<span className="text-muted">
										{t(`apiClientTools.response.timings.${phase}`)}
									</span>
									<span className="relative h-2 rounded-sm bg-bar-track">
										{value === null ? null : (
											<span
												className="absolute inset-y-0 rounded-sm bg-primary"
												style={{
													left: `${left}%`,
													width: `${Math.max(1, (value / total) * 100)}%`,
												}}
											/>
										)}
									</span>
									<span className="text-right">
										{value === null
											? t("apiClientTools.response.timings.skipped")
											: ms(value)}
									</span>
								</li>
							);
						})}
					</ul>
				)}
				<p className="m-0 flex justify-between border-border-subtle border-t pt-2 font-semibold">
					<span>{t("apiClientTools.response.timings.total")}</span>
					<span>{ms(response.timings.total)}</span>
				</p>
				<p
					data-id={limited ? "response-timings-limited" : undefined}
					className={cn("m-0 text-muted text-xs", !limited && "wrap-anywhere")}
				>
					{limited
						? renderRich(t("apiClientTools.response.timings.limited"))
						: t("apiClientTools.response.timings.finalUrl", {
								url: response.finalUrl,
							})}
				</p>
				{limited ? null : (
					<p className="m-0 text-muted text-xs">
						{t("apiClientTools.response.timings.proxyNote")}
					</p>
				)}
			</section>
		</div>
	);
}
