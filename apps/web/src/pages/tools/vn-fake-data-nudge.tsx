import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const CTA_CLASS = cn(buttonClassName({ variant: "primary" }), "no-underline");

/**
 * "Use this data as a mock API": a guest signs in and lands on the
 * projects, where a resource is created; a signed-in user goes straight
 * there. The prerendered page shows the guest version until the session
 * is known.
 */
export function VnFakeDataNudge() {
	const t = useT();
	const signedIn = useCurrentUser().status === "authenticated";
	const label = (
		<>
			{t(
				signedIn ? "vnFakeData.nudge.openProjects" : "vnFakeData.nudge.signIn",
			)}
			<IconArrowRight size={16} aria-hidden="true" />
		</>
	);
	return (
		<section
			data-id="vn-fake-data-nudge"
			aria-labelledby="vn-fake-data-nudge-title"
			className={cn(
				cardClassName,
				"flex flex-wrap items-center justify-between gap-4 p-6",
			)}
		>
			<div className="grid min-w-0 gap-1">
				<h2 id="vn-fake-data-nudge-title" className="m-0 font-bold text-lg">
					{t("vnFakeData.nudge.title")}
				</h2>
				<p className="m-0 text-muted text-sm">{t("vnFakeData.nudge.text")}</p>
			</div>
			{signedIn ? (
				<Link
					to="/projects"
					data-id="vn-fake-data-nudge-cta"
					className={CTA_CLASS}
				>
					{label}
				</Link>
			) : (
				<LoginLink
					returnTo="/projects"
					data-id="vn-fake-data-nudge-cta"
					className={CTA_CLASS}
				>
					{label}
				</LoginLink>
			)}
		</section>
	);
}
