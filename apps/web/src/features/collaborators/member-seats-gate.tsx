import { IconLock } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";

export interface MemberSeatsGateProps {
	/** null while the list loads. */
	seats: { used: number; max: number | null } | null;
	canManage: boolean;
}

/** `max` null means the project has no member cap. */
export function seatsFull(seats: {
	used: number;
	max: number | null;
}): boolean {
	return seats.max !== null && seats.used >= seats.max;
}

/**
 * "n/cap members" and, for the owner of a full project, why nobody else
 * can be invited. Sits above the invite fieldset
 * so it is read before the disabled controls.
 */
export function MemberSeatsGate({ seats, canManage }: MemberSeatsGateProps) {
	const t = useT();
	const count = seats ? `${seats.used}/${seats.max ?? "∞"}` : "…";
	// The cap that is reached, or null while there is room.
	const reached = seats && seatsFull(seats) ? seats.max : null;
	return (
		<div className="grid gap-2">
			<p
				data-id="modal-collaborators-count"
				className="m-0 font-mono text-muted text-[0.8125rem]"
			>
				{t("collaborators.seats.count", { seats: count })}
			</p>
			{canManage && reached !== null ? (
				<div
					data-id="modal-collaborators-full"
					className="flex flex-wrap items-center gap-2"
				>
					<Badge tone="accent">
						<IconLock size={14} aria-hidden="true" />
						{t("collaborators.seats.full", { count: reached })}
					</Badge>
					<span className="text-muted text-[0.8125rem]">
						{t("collaborators.seats.removeToInvite")}
					</span>
				</div>
			) : null}
		</div>
	);
}
