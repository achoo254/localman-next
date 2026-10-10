import type { ReactNode } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { UpstreamKind } from "./upstream-form-state";

export interface UpstreamOptionProps {
	kind: UpstreamKind;
	/** `name` of the radio group. */
	name: string;
	checked: boolean;
	onSelect: (kind: UpstreamKind) => void;
	/** Fields of the choice (port, URL), shown while it is selected. */
	children?: ReactNode;
}

/**
 * One choice of the upstream as a card: a real radio inside its label,
 * then the choice's own fields below the label (a label must not hold
 * another field).
 */
export function UpstreamOption({
	kind,
	name,
	checked,
	onSelect,
	children,
}: UpstreamOptionProps) {
	const t = useT();
	return (
		<div
			data-id={`project-detail-upstream-${kind}`}
			className={cn(
				"grid min-w-0 content-start gap-3 rounded-lg border bg-surface p-4 transition-colors",
				checked ? "border-primary" : "border-border",
			)}
		>
			<label className="flex cursor-pointer items-start gap-3">
				<input
					type="radio"
					name={name}
					value={kind}
					checked={checked}
					onChange={() => onSelect(kind)}
					className="mt-1 size-4 flex-none cursor-pointer accent-primary-solid focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed"
				/>
				<span className="grid min-w-0 gap-1">
					<span className="font-mono font-semibold text-fg text-sm">
						{t(`upstream.options.${kind}.title`)}
					</span>
					<span className="text-muted text-sm">
						{t(`upstream.options.${kind}.help`)}
					</span>
				</span>
			</label>
			{checked ? children : null}
		</div>
	);
}
