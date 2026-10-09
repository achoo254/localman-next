import type { CurrentUser } from "../../features/auth/current-user";
import { displayName } from "../../features/auth/current-user";
import { useT } from "../../i18n/i18n-context";

/** IdP profile picture, or the first letter of the user's name. */
export function UserAvatar({ user }: { user: CurrentUser }) {
	const t = useT();
	const picture = user.picture?.startsWith("https://") ? user.picture : null;
	if (picture) {
		return (
			<img
				src={picture}
				alt=""
				referrerPolicy="no-referrer"
				className="size-7 shrink-0 rounded-sm object-cover"
			/>
		);
	}
	const initial = displayName(user, t("auth.accountFallback"))
		.normalize("NFD")
		.charAt(0)
		.toUpperCase();
	return (
		<span
			aria-hidden="true"
			className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary-solid font-bold font-mono text-[0.8125rem] text-on-primary"
		>
			{initial}
		</span>
	);
}
