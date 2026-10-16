import { COMMENT_BODY_MAX } from "@localman/shared/api-client";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import {
	type MentionCandidate,
	type MentionQuery,
	completeMention,
	mentionAt,
	suggestPeople,
} from "./mention-suggestions";

export interface CommentComposerProps {
	/** Accessible name of the text field. */
	label: string;
	submitLabel: string;
	/** People offered after `@`. */
	people: readonly MentionCandidate[];
	/** Rejects to keep the text (the caller shows the error). */
	onSubmit: (body: string) => Promise<void>;
	onCancel?: () => void;
	initial?: string;
	placeholder?: string;
	/** Prefix of the `data-id`s: `{dataId}-input`, `{dataId}-send`. */
	dataId: string;
	autoFocus?: boolean;
}

/** Markdown text with `@` completion; Ctrl/Cmd+Enter sends. */
export function CommentComposer(props: CommentComposerProps) {
	const t = useT();
	const listId = useId();
	const field = useRef<HTMLTextAreaElement>(null);
	const [body, setBody] = useState(props.initial ?? "");
	const [query, setQuery] = useState<MentionQuery | null>(null);
	const [active, setActive] = useState(0);
	const [sending, setSending] = useState(false);
	const suggestions = query ? suggestPeople(props.people, query.prefix) : [];
	const open = suggestions.length > 0;

	const track = (text: string, caret: number) => {
		setQuery(mentionAt(text, caret));
		setActive(0);
	};
	const pick = (person: MentionCandidate) => {
		const input = field.current;
		if (!input || !query) return;
		const next = completeMention(
			body,
			input.selectionStart,
			query,
			person.username,
		);
		setBody(next.text);
		setQuery(null);
		requestAnimationFrame(() => {
			input.focus();
			input.setSelectionRange(next.caret, next.caret);
		});
	};
	const send = async () => {
		const text = body.trim();
		if (text === "" || sending) return;
		setSending(true);
		try {
			await props.onSubmit(text);
			setBody("");
		} catch {
			// The caller shows why; the text stays for another try.
		} finally {
			setSending(false);
		}
	};
	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		// Keys that confirm an IME composition (Vietnamese, Chinese) are its own.
		if (event.nativeEvent.isComposing) return;
		if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive(
				(index) => (index + step + suggestions.length) % suggestions.length,
			);
			return;
		}
		const chosen = suggestions[active];
		if (open && chosen && (event.key === "Enter" || event.key === "Tab")) {
			event.preventDefault();
			pick(chosen);
			return;
		}
		if (open && event.key === "Escape") {
			event.stopPropagation();
			setQuery(null);
			return;
		}
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void send();
		}
	};

	return (
		<div className="grid gap-2">
			<div className="relative">
				<Textarea
					ref={field}
					value={body}
					rows={3}
					maxLength={COMMENT_BODY_MAX}
					aria-label={props.label}
					placeholder={props.placeholder}
					autoFocus={props.autoFocus}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={open ? listId : undefined}
					aria-activedescendant={open ? `${listId}-${active}` : undefined}
					data-id={`${props.dataId}-input`}
					onChange={(event) => {
						setBody(event.target.value);
						track(event.target.value, event.target.selectionStart);
					}}
					onSelect={(event) =>
						track(event.currentTarget.value, event.currentTarget.selectionStart)
					}
					onBlur={() => setQuery(null)}
					onKeyDown={onKeyDown}
				/>
				{open ? (
					<div
						id={listId}
						// biome-ignore lint/a11y/useSemanticElements: custom listbox under the field; the field drives it with the arrow keys and keeps focus.
						role="listbox"
						tabIndex={-1}
						aria-label={t("collections.comments.mentionList")}
						data-id="comment-mention-list"
						className="absolute inset-x-0 top-full z-10 mt-1 grid rounded-md border border-border-subtle bg-surface p-1 shadow-lg"
					>
						{suggestions.map((person, index) => (
							<div
								key={person.username}
								id={`${listId}-${index}`}
								// biome-ignore lint/a11y/useSemanticElements: option of the custom listbox; picked by mouse here, by keyboard through the field.
								role="option"
								tabIndex={-1}
								aria-selected={index === active}
								data-id="comment-mention-option"
								className={cn(
									"cursor-pointer rounded-sm px-2 py-1 text-sm",
									index === active && "bg-primary/10 text-primary",
								)}
								// Keep the focus in the field while picking.
								onMouseDown={(event) => {
									event.preventDefault();
									pick(person);
								}}
							>
								<span className="font-mono">@{person.username}</span>
								{person.name ? (
									<span className="ml-2 text-muted">{person.name}</span>
								) : null}
							</div>
						))}
					</div>
				) : null}
			</div>
			<div className="flex justify-end gap-2">
				{props.onCancel ? (
					<Button size="sm" variant="ghost" onClick={props.onCancel}>
						{t("collections.comments.cancel")}
					</Button>
				) : null}
				<Button
					size="sm"
					data-id={`${props.dataId}-send`}
					loading={sending}
					disabled={body.trim() === ""}
					onClick={() => void send()}
				>
					{props.submitLabel}
				</Button>
			</div>
		</div>
	);
}
