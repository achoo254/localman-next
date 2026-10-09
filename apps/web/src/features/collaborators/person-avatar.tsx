import { cn } from "../../lib/cn";
import {
	avatarInitial,
	avatarToneClass,
} from "../../pages/projects/project-avatar";

export interface PersonAvatarProps {
	/** Display name, username or email: drives the initial and colour. */
	name: string;
	picture: string | null;
}

/**
 * 32px avatar of a person in member lists: the IdP picture when it is an
 * `https://` URL (as `UserAvatar`), else the initial on its colour group.
 */
export function PersonAvatar({ name, picture }: PersonAvatarProps) {
	if (picture?.startsWith("https://")) {
		return (
			<img
				src={picture}
				alt=""
				referrerPolicy="no-referrer"
				className="size-8 shrink-0 rounded-sm object-cover"
			/>
		);
	}
	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid size-8 shrink-0 place-items-center rounded-sm font-bold font-mono text-on-tone text-sm uppercase",
				avatarToneClass(name),
			)}
		>
			{avatarInitial(name)}
		</span>
	);
}
