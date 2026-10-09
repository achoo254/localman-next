import type { PlanId } from "@localman/shared/constants";
import { IconLock } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

export interface MemberSeatsGateProps {
	/** null while the list loads. */
	seats: { used: number; max: number | null } | null;
	/** Plan of the owner; only shown with `canManage` (the viewer is the owner). */
	plan: PlanId;
	canManage: boolean;
	onPlans: () => void;
}

/** `max` null means the plan has no member cap. */
export function seatsFull(seats: {
	used: number;
	max: number | null;
}): boolean {
	return seats.max !== null && seats.used >= seats.max;
}

/**
 * "n/cap thành viên" and, for the owner of a full project, why nobody else
 * can be invited (with "Xem gói" on Free). Sits above the invite fieldset
 * so it is read before the disabled controls.
 */
export function MemberSeatsGate({
	seats,
	plan,
	canManage,
	onPlans,
}: MemberSeatsGateProps) {
	const count = seats ? `${seats.used}/${seats.max ?? "∞"}` : "…";
	// The cap that is reached, or null while there is room.
	const reached = seats && seatsFull(seats) ? seats.max : null;
	return (
		<div className="grid gap-2">
			<p
				data-id="modal-collaborators-count"
				className="m-0 font-mono text-muted text-[0.8125rem]"
			>
				{count} thành viên (tính cả owner và lời mời đang chờ)
			</p>
			{canManage && reached !== null ? (
				<div
					data-id="modal-collaborators-full"
					className="flex flex-wrap items-center gap-2"
				>
					<Badge tone="accent">
						<IconLock size={14} aria-hidden="true" />
						Đã đủ {reached} thành viên
					</Badge>
					<span className="text-muted text-[0.8125rem]">
						{plan === "free"
							? `Thành viên thứ ${reached + 1} cần gói Pro.`
							: "Xoá bớt thành viên hoặc lời mời để mời thêm."}
					</span>
					{plan === "free" ? (
						<Button
							size="sm"
							data-id="modal-collaborators-plans"
							onClick={onPlans}
						>
							Xem gói
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
