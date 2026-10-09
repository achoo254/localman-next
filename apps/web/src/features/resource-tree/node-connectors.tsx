import { cn } from "../../lib/cn";
import type { ConnectorState } from "./use-tree-connect";

const HANDLE =
	"-translate-x-1/2 -translate-y-1/2 absolute z-2 size-4 cursor-pointer rounded-full border-[1.5px] p-0 " +
	"transition-[background-color,border-color,opacity] before:absolute before:-inset-2.5 before:rounded-full before:content-['']";

export interface SelectConnectorProps {
	name: string;
	selected: boolean;
	/** Distance from the node's top edge, in px. */
	top: number;
	"data-id": string;
	onSelect: () => void;
}

/** Left connector of a node: picks the resource to move. */
export function SelectConnector({
	name,
	selected,
	top,
	"data-id": dataId,
	onSelect,
}: SelectConnectorProps) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			aria-label={`Chọn ${name} để di chuyển`}
			data-id={dataId}
			style={{ top }}
			className={cn(
				HANDLE,
				"left-0",
				selected
					? "border-primary bg-primary"
					: "border-icon-muted bg-surface hover:border-primary",
			)}
			onClick={onSelect}
		/>
	);
}

export interface NestConnectorProps {
	name: string;
	/** Name of the selected resource, used in the label. */
	selectionName: string | null;
	state: ConnectorState;
	top: number;
	"data-id": string;
	onNest: () => void;
}

/** Right connector of a node: nests the selected resource into it. */
export function NestConnector({
	name,
	selectionName,
	state,
	top,
	"data-id": dataId,
	onNest,
}: NestConnectorProps) {
	return (
		<button
			type="button"
			aria-label={`Lồng ${selectionName ?? "resource đang chọn"} vào ${name}`}
			aria-disabled={state === "invalid" || undefined}
			data-id={dataId}
			data-state={state}
			style={{ top }}
			className={cn(
				HANDLE,
				"left-full",
				state === "target" && "border-primary bg-primary",
				state === "invalid" &&
					"cursor-not-allowed border-icon-muted bg-surface opacity-30",
				state === "idle" && "border-icon-muted bg-surface hover:border-primary",
			)}
			onClick={onNest}
		/>
	);
}
