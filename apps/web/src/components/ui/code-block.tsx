import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { copyText } from "../../platform/clipboard";
import { COPIED_RESET_MS } from "./copy-field";
import { IconButton } from "./icon-button";

type CopyState = "idle" | "copied" | "failed";

/** Announced in the block's own live region. */
const NOTES: Record<CopyState, string> = {
	idle: "",
	copied: "Đã sao chép mã",
	failed: "Không sao chép được, mã đã được chọn để bạn sao chép thủ công.",
};

export interface CodeBlockProps {
	/** Shown above the code: language or what the snippet does. */
	caption: string;
	code: string;
	/**
	 * Wraps long lines instead of scrolling: for one-line shell commands,
	 * which must stay one line in the copied text. JSON keeps scrolling.
	 */
	wrap?: boolean;
	"data-id": string;
}

/** Selects the code so a refused clipboard still leaves one shortcut. */
function selectContents(element: HTMLElement | null): void {
	const selection = window.getSelection();
	if (!element || !selection) return;
	selection.selectAllChildren(element);
}

/**
 * Read-only snippet in the mono font with a copy button. Long lines scroll
 * inside the block (focusable, so keyboard users can scroll it too), never
 * the page; `wrap` breaks them visually instead (the copy is unchanged).
 * Plain `<pre>`: the docs chunk stays free of CodeMirror.
 */
export function CodeBlock({
	caption,
	code,
	wrap = false,
	"data-id": dataId,
}: CodeBlockProps) {
	const captionId = useId();
	const pre = useRef<HTMLPreElement>(null);
	const [state, setState] = useState<CopyState>("idle");

	useEffect(() => {
		if (state !== "copied") return;
		const timer = window.setTimeout(() => setState("idle"), COPIED_RESET_MS);
		return () => window.clearTimeout(timer);
	}, [state]);

	const copy = async () => {
		if (await copyText(code)) {
			setState("copied");
			return;
		}
		setState("failed");
		selectContents(pre.current);
	};

	const copied = state === "copied";
	return (
		<figure
			data-id={dataId}
			aria-labelledby={captionId}
			className="m-0 min-w-0 overflow-hidden rounded-md border border-border bg-surface-subtle"
		>
			<div className="flex items-center justify-between gap-2 border-border-subtle border-b py-1 pr-1 pl-3">
				<figcaption
					id={captionId}
					className="font-mono text-muted text-xs uppercase tracking-wide"
				>
					{caption}
				</figcaption>
				<IconButton
					size="sm"
					label={copied ? "Đã sao chép" : `Sao chép mã ${caption}`}
					data-id={`${dataId}-copy`}
					icon={
						copied ? (
							<IconCheck size={18} aria-hidden="true" />
						) : (
							<IconCopy size={18} aria-hidden="true" />
						)
					}
					onClick={() => void copy()}
				/>
			</div>
			<pre
				ref={pre}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
				tabIndex={0}
				className={cn(
					"m-0 overflow-x-auto p-3 font-mono text-fg text-sm leading-relaxed",
					wrap && "wrap-anywhere whitespace-pre-wrap",
				)}
			>
				<code>{code}</code>
			</pre>
			{state === "failed" ? (
				<p className="m-0 border-border-subtle border-t px-3 py-2 text-muted text-xs">
					{NOTES.failed}
				</p>
			) : null}
			<output aria-live="polite" className="sr-only">
				{NOTES[state]}
			</output>
		</figure>
	);
}
