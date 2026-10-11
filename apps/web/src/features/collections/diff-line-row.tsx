import type { ReactNode } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { DiffLine } from "./line-diff";

const LINE = {
	same: "text-fg",
	removed: "bg-error/12 text-fg",
	added: "bg-success/12 text-fg",
} as const;
const MARK = { same: " ", removed: "-", added: "+" } as const;

/** One line of a diff; screen readers hear "Before:" or "After:" first. */
export function DiffLineRow({ line }: { line: DiffLine }) {
	const t = useT();
	return (
		<div
			data-diff={line.kind}
			className={cn("flex min-w-max whitespace-pre px-2", LINE[line.kind])}
		>
			<span aria-hidden="true" className="w-3 flex-none select-none text-muted">
				{MARK[line.kind]}
			</span>
			<span className="sr-only">
				{line.kind === "removed"
					? `${t("collections.changelog.before")}: `
					: line.kind === "added"
						? `${t("collections.changelog.after")}: `
						: ""}
			</span>
			{line.text}
		</div>
	);
}

/** A full-width row button inside the diff: unfold lines, or draw more. */
export function DiffMoreButton(props: {
	children: ReactNode;
	dataId?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			data-id={props.dataId ?? "changelog-diff-unfold"}
			onClick={props.onClick}
			className="block w-full cursor-pointer border-0 border-border-subtle border-y bg-surface-subtle px-2 py-0.5 text-left font-sans text-muted text-xs hover:text-fg focus-visible:shadow-focus-primary focus-visible:outline-none"
		>
			{props.children}
		</button>
	);
}
