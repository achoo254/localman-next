import { IconLock } from "@tabler/icons-react";
import type { ReactNode } from "react";

export interface ReadonlyNoteProps {
	children: ReactNode;
	"data-id": string;
}

/** Lock icon and why a collaborator cannot change a traffic setting. */
export function ReadonlyNote({
	children,
	"data-id": dataId,
}: ReadonlyNoteProps) {
	return (
		<p
			data-id={dataId}
			className="m-0 flex items-start gap-2 text-muted text-sm"
		>
			<IconLock
				size={16}
				aria-hidden="true"
				className="mt-0.5 flex-none text-icon-muted"
			/>
			<span>{children}</span>
		</p>
	);
}
