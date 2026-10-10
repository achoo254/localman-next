import { IconX } from "@tabler/icons-react";
import { IconButton } from "../../../components/ui/icon-button";

export interface HostListProps {
	items: readonly { host: string; detail?: string }[];
	empty: string;
	removeLabel: (host: string) => string;
	onRemove: (host: string) => void;
	"data-id": string;
}

/** Hosts (or origins) of a routing list, each with a remove button. */
export function HostList({
	items,
	empty,
	removeLabel,
	onRemove,
	"data-id": dataId,
}: HostListProps) {
	if (items.length === 0) {
		return (
			<p data-id={`${dataId}-empty`} className="m-0 text-muted text-sm">
				{empty}
			</p>
		);
	}
	return (
		<ul data-id={dataId} className="m-0 grid list-none gap-1 p-0">
			{items.map(({ host, detail }) => (
				<li
					key={host}
					data-id={`${dataId}-item`}
					className="flex items-center justify-between gap-2 rounded-sm bg-surface py-0.5 pr-0.5 pl-2"
				>
					<span className="grid min-w-0">
						<code className="truncate font-mono text-sm">{host}</code>
						{detail ? (
							<span className="text-muted text-xs">{detail}</span>
						) : null}
					</span>
					<IconButton
						size="sm"
						variant="ghost"
						label={removeLabel(host)}
						icon={<IconX size={16} aria-hidden="true" />}
						data-id={`${dataId}-remove`}
						onClick={() => onRemove(host)}
					/>
				</li>
			))}
		</ul>
	);
}
