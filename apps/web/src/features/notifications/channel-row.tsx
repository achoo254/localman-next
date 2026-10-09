import type { ReactNode } from "react";

export interface ChannelRowProps {
	title: string;
	description: ReactNode;
	/** Button or link on the right. */
	action?: ReactNode;
	/** Extra content under the description (e.g. a reminder). */
	children?: ReactNode;
	"data-id": string;
	statusId: string;
}

/** One delivery channel in the "Kênh nhận thông báo" card. */
export function ChannelRow({
	title,
	description,
	action,
	children,
	"data-id": dataId,
	statusId,
}: ChannelRowProps) {
	return (
		<div
			data-id={dataId}
			className="grid gap-3 border-border-subtle border-t py-3"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="grid min-w-0 gap-0.5">
					<h3 className="m-0 font-mono font-semibold text-sm">{title}</h3>
					<p
						data-id={statusId}
						className="m-0 text-[0.8125rem] text-muted leading-normal"
					>
						{description}
					</p>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</div>
	);
}
