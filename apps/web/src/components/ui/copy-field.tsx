import { IconCheck, IconCopy } from "@tabler/icons-react";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { cn } from "../../lib/cn";
import { copyText } from "../../platform/clipboard";
import { buttonClassName } from "./button";
import { FormField } from "./form-field";
import { Input } from "./input";

/** How long the button shows the check mark after a copy. */
export const COPIED_RESET_MS = 2000;

const COPIED = "Đã sao chép link";
/** The automatic copy after a request usually lost the click's permission. */
const AUTO_FAILED = "Bấm nút sao chép để copy link.";
const FAILED = "Không sao chép được, hãy chọn link và sao chép thủ công.";

export interface CopyFieldHandle {
	/** Copies the value, exactly like the copy button. */
	copy: () => Promise<void>;
	focusCopyButton: () => void;
}

export interface CopyFieldProps {
	label: ReactNode;
	/** Keeps the label for screen readers only (the context names it). */
	hideLabel?: boolean;
	value: string;
	hint?: ReactNode;
	/** Copies once on mount, e.g. a link that was just created. */
	autoCopy?: boolean;
	"data-id": string;
	copyDataId: string;
	ref?: Ref<CopyFieldHandle>;
}

type CopyState = "idle" | "copied" | "auto-failed" | "failed";

/** Announced in the live region; failures also join the hint. */
const NOTES: Record<CopyState, string> = {
	idle: "",
	copied: COPIED,
	"auto-failed": AUTO_FAILED,
	failed: FAILED,
};

/**
 * Read-only value with a copy button. The result is announced by its own
 * live region: inside a modal, Radix hides everything else (toasts
 * included) from assistive technology. When the clipboard is refused by a
 * click, the text is selected so the user can copy it by hand; a refused
 * automatic copy only points at the button.
 */
export function CopyField({
	label,
	hideLabel = false,
	value,
	hint,
	autoCopy = false,
	"data-id": dataId,
	copyDataId,
	ref,
}: CopyFieldProps) {
	const input = useRef<HTMLInputElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const [state, setState] = useState<CopyState>("idle");

	const copyAs = useCallback(
		async (auto: boolean) => {
			const ok = await copyText(value);
			if (ok) setState("copied");
			else if (auto) setState("auto-failed");
			else {
				setState("failed");
				input.current?.select();
			}
		},
		[value],
	);
	const copy = useCallback(() => copyAs(false), [copyAs]);

	useImperativeHandle(
		ref,
		() => ({ copy, focusCopyButton: () => button.current?.focus() }),
		[copy],
	);

	useEffect(() => {
		if (state !== "copied") return;
		const timer = window.setTimeout(() => setState("idle"), COPIED_RESET_MS);
		return () => window.clearTimeout(timer);
	}, [state]);

	const copyOnMount = useRef(autoCopy);
	useEffect(() => {
		if (!copyOnMount.current) return;
		copyOnMount.current = false;
		void copyAs(true);
	}, [copyAs]);

	const copied = state === "copied";
	// A refused clipboard is not an invalid value: a neutral hint, no error.
	const failure = state === "failed" || state === "auto-failed";
	return (
		<FormField
			label={hideLabel ? <span className="sr-only">{label}</span> : label}
			hint={
				failure ? (
					<>
						{hint ? <span className="block">{hint}</span> : null}
						{NOTES[state]}
					</>
				) : (
					hint
				)
			}
		>
			<div className="flex gap-2">
				<Input
					ref={input}
					readOnly
					value={value}
					data-id={dataId}
					className="min-w-0 flex-1"
					onFocus={(event) => event.currentTarget.select()}
				/>
				<button
					ref={button}
					type="button"
					aria-label={copied ? "Đã sao chép" : "Sao chép link"}
					data-id={copyDataId}
					className={cn(
						buttonClassName({ variant: "secondary", iconOnly: true }),
						"size-11",
					)}
					onClick={() => void copy()}
				>
					{copied ? (
						<IconCheck size={20} aria-hidden="true" />
					) : (
						<IconCopy size={20} aria-hidden="true" />
					)}
				</button>
			</div>
			<output aria-live="polite" className="sr-only">
				{NOTES[state]}
			</output>
		</FormField>
	);
}
