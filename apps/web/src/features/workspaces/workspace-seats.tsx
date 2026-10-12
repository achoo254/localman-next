import { useT } from "../../i18n/i18n-context";
import { seatsFull } from "./workspace-labels";

export interface WorkspaceSeatsProps {
	seats: { used: number; max: number | null };
	/** Admins see why nobody else can be invited. */
	canManage: boolean;
}

/**
 * "3/3 members (pending invitations included)" and, for an Admin of a
 * full workspace, why the invite controls are locked. Sits above the
 * invite form so it is read first.
 */
export function WorkspaceSeats({ seats, canManage }: WorkspaceSeatsProps) {
	const t = useT();
	const count =
		seats.max === null
			? t("workspaces.members.seatsNoCap", { used: seats.used })
			: t("workspaces.members.seats", { used: seats.used, max: seats.max });
	const full = canManage && seatsFull(seats);
	return (
		<div className="grid gap-3">
			<p
				data-id="ws-settings-member-count"
				className="m-0 font-mono text-muted text-[0.8125rem]"
			>
				{count}
			</p>
			{full ? (
				<p
					data-id="ws-settings-members-full"
					className="m-0 text-muted text-sm"
				>
					{t("workspaces.members.full")}
				</p>
			) : null}
		</div>
	);
}
