import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** On the solid primary band the button flips to the surface colour. */
function ctaClass(inverse: boolean): string {
	return cn(
		buttonClassName({ variant: inverse ? "secondary" : "primary", size: "lg" }),
		"no-underline max-sm:w-full",
		inverse && "shadow-lg",
	);
}

const LABEL_CELL = "col-start-1 row-start-1";

/**
 * Main call to action of the landing (hero, after the demos, closing band):
 * "Try it free" signs a visitor up, "Open app" takes a signed-in user to the
 * projects. The prerendered page does not know the session, so both labels
 * sit in one grid cell, the unused one invisible and hidden from assistive
 * tech: the button keeps the width of the longer label when the session
 * answer swaps them, and the hero does not shift.
 */
export function StartCta({
	"data-id": dataId,
	inverse = false,
}: {
	"data-id": string;
	inverse?: boolean;
}) {
	const t = useT();
	const className = ctaClass(inverse);
	const signedIn = useCurrentUser().status === "authenticated";
	const content = (
		<>
			<span className="grid justify-items-center">
				<span
					className={cn(LABEL_CELL, signedIn && "invisible")}
					aria-hidden={signedIn ? true : undefined}
				>
					{t("landing.cta.tryFree")}
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
		<Link to="/projects" data-id={dataId} className={className}>
			{content}
		</Link>
	) : (
		<LoginLink
			returnTo="/projects"
			prompt="create"
			data-id={dataId}
			className={className}
		>
			{content}
		</LoginLink>
	);
}
