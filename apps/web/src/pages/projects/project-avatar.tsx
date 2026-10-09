import { cn } from "../../lib/cn";

/**
 * Seven colour groups. Each pairs a data-viz hue (Radix step 11 in light,
 * step 9-ish in dark) with `--c-on-tone`; every pair is ≥ 4.6:1 in both
 * themes. Letters a–z fall into groups of four; anything else is grey.
 */
const GROUPS = [
	"bg-viz-violet",
	"bg-viz-blue",
	"bg-viz-cyan",
	"bg-viz-green",
	"bg-viz-amber",
	"bg-viz-red",
	"bg-viz-grey",
] as const;

/** Base Latin letter of a name: "Đơn hàng" → "D", "ứng dụng" → "U". */
export function avatarInitial(name: string): string {
	const letter = name
		.trim()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[đĐ]/g, "d")
		.charAt(0);
	return letter ? letter.toUpperCase() : "?";
}

/** 0–5 for a–x in groups of four (y, z join group 5), 6 for the rest. */
export function avatarGroup(name: string): number {
	const code = avatarInitial(name).toLowerCase().charCodeAt(0);
	if (code < 97 || code > 122) return GROUPS.length - 1;
	return Math.min(GROUPS.length - 2, Math.floor((code - 97) / 4));
}

export function ProjectAvatar({ name }: { name: string }) {
	const group = avatarGroup(name);
	return (
		<span
			aria-hidden="true"
			data-group={group + 1}
			className={cn(
				"grid size-11 shrink-0 place-items-center rounded-md font-bold font-mono text-lg text-on-tone uppercase",
				GROUPS[group],
			)}
		>
			{avatarInitial(name)}
		</span>
	);
}
