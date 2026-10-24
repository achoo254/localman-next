import { brand } from "@localman/shared/brand";
import {
	IconArrowRight,
	IconLock,
	IconRobot,
	IconSend,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LEGAL_PATHS } from "../../lib/legal";
import { LandingSection } from "./landing-section";

const POINTS = [
	{ id: "sealed", icon: IconLock },
	{ id: "direct", icon: IconSend },
	{ id: "agents", icon: IconRobot },
] as const;

/**
 * "Secrets never leave the browser": the vault's promise, worded as the
 * data transparency page states it, and a link there. Loaded only when
 * the `secretVault` flag is on.
 */
export function SecretsStaySection() {
	const t = useT();
	const app = brand.appName;
	const points = {
		sealed: t("dataTransparency.landing.points.sealed"),
		direct: t("dataTransparency.landing.points.direct", { app }),
		agents: t("dataTransparency.landing.points.agents", { app }),
	};
	return (
		<LandingSection
			id="secrets"
			data-id="landing-secrets"
			eyebrow={t("dataTransparency.landing.eyebrow")}
			title={t("dataTransparency.landing.title")}
			lead={t("dataTransparency.landing.lead", { app })}
		>
			<ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
				{POINTS.map(({ id, icon: Icon }) => (
					<li
						key={id}
						data-id={`landing-secrets-${id}`}
						className={cn(cardClassName, "flex items-start gap-3 p-5")}
					>
						<Icon
							size={20}
							aria-hidden="true"
							className="shrink-0 text-primary"
						/>
						<span className="text-sm">{points[id]}</span>
					</li>
				))}
			</ul>
			<Link
				to={LEGAL_PATHS.yourData}
				data-id="landing-secrets-link"
				className={cn(
					buttonClassName({ variant: "secondary" }),
					"justify-self-start no-underline",
				)}
			>
				{t("dataTransparency.landing.link")}
				<IconArrowRight size={16} aria-hidden="true" />
			</Link>
		</LandingSection>
	);
}
