import { IconCircleCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";

export interface SuccessPanelProps {
	title: ReactNode;
	children?: ReactNode;
	"data-id"?: string;
}

/**
 * Centred confirmation shown in place of a form once it was sent: a check
 * on a success tint, a title and an optional line. Put it inside a live
 * region (or an `<output>`) so screen readers announce it.
 */
export function SuccessPanel({
	title,
	children,
	"data-id": dataId,
}: SuccessPanelProps) {
	return (
		<div
			data-id={dataId}
			className="grid justify-items-center gap-3 py-4 text-center"
		>
			<span className="tint-soft grid size-14 place-items-center rounded-full border text-success [--tone:var(--c-success)]">
				<IconCircleCheck size={32} aria-hidden="true" />
			</span>
			<strong className="text-lg">{title}</strong>
			{children ? <span>{children}</span> : null}
		</div>
	);
}
