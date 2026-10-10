import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const CTA_CLASS = cn(
	buttonClassName({ variant: "primary", size: "lg" }),
	"no-underline max-sm:w-full",
);

const LABEL_CELL = "col-start-1 row-start-1";

/**
 * Main call to action of the landing (hero and closing band): "Get started
 * free" signs a visitor up, "Open app" takes a signed-in user to the
 * projects. The prerendered page does not know the session, so both labels
 * sit in one grid cell, the unused one invisible and hidden from assistive
 * tech: the button keeps the width of the longer label when the session
 * answer swaps them, and the hero does not shift.
 */
export function StartCta({ "data-id": dataId }: { "data-id": string }) {
	const t = useT();
	const signedIn = useCurrentUser().status === "authenticated";
	const content = (
		<>
			<span className="grid justify-items-center">
				<span
					className={cn(LABEL_CELL, signedIn && "invisible")}
					aria-hidden={signedIn ? true : undefined}
				>
					{t("common.cta.startFree")}
				</span>
				<span
					className={cn(LABEL_CELL, !signedIn && "invisible")}
					aria-hidden={signedIn ? undefined : true}
				>
					{t("common.cta.openApp")}
				</span>
			</span>
			<IconArrowRight size={20} aria-hidden="true" />
		</>
	);
	return signedIn ? (
		<Link to="/projects" data-id={dataId} className={CTA_CLASS}>
			{content}
		</Link>
	) : (
		<LoginLink
			returnTo="/projects"
			prompt="create"
			data-id={dataId}
			className={CTA_CLASS}
		>
			{content}
		</LoginLink>
	);
}
