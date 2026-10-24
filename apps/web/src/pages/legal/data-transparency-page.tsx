import { brand } from "@localman/shared/brand";
import { IconLock } from "@tabler/icons-react";
import { Link, Navigate } from "react-router";
import { LegalLinks } from "../../components/layout/legal-links";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { LEGAL_PATHS } from "../../lib/legal";
import { useAppTitle } from "../../lib/use-document-title";
import { DataItemsTable } from "./data-items-table";
import { TEXT_LINK } from "./legal-text";
import { LogFieldsSection } from "./log-fields-section";

const HEADING = "m-0 font-bold font-mono text-base";

function SecretsPromise() {
	const t = useT();
	const app = brand.appName;
	return (
		<section
			aria-labelledby="your-data-promise-title"
			data-id="your-data-promise"
			className="grid gap-2 rounded-md border border-primary/40 bg-primary/6 p-4"
		>
			<h2
				id="your-data-promise-title"
				className="m-0 flex items-center gap-2 font-bold text-base"
			>
				<IconLock size={18} aria-hidden="true" className="text-primary" />
				{t("dataTransparency.promise.title")}
			</h2>
			<p className="m-0">{t("dataTransparency.promise.body", { app })}</p>
			<p className="m-0 text-muted text-sm">
				{t("dataTransparency.promise.exceptions")}
			</p>
		</section>
	);
}

function DataTransparency() {
	const t = useT();
	const app = brand.appName;
	useAppTitle(t("dataTransparency.title"));
	const privacyLink = {
		privacy: (chunk: string) => (
			<Link to={LEGAL_PATHS.privacy} className={TEXT_LINK}>
				{chunk}
			</Link>
		),
	};
	return (
		<article data-id="your-data" className="mx-auto grid max-w-3xl gap-4">
			<header className="grid gap-1">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("dataTransparency.title")}
				</h1>
				<p className="m-0 text-muted text-sm">
					{t("dataTransparency.intro", { app })}
				</p>
			</header>
			<div
				className={cn(
					cardClassName,
					"grid gap-6 px-5 py-6 text-[0.9375rem] text-fg leading-relaxed sm:px-8",
				)}
			>
				<SecretsPromise />
				<DataItemsTable />
				<LogFieldsSection kind="proxyLog" />
				<LogFieldsSection kind="serverLog" />
				<LogFieldsSection kind="webServerLog" />
				<section
					aria-labelledby="your-data-telemetry-title"
					data-id="your-data-telemetry"
					className="grid gap-2"
				>
					<h2 id="your-data-telemetry-title" className={HEADING}>
						{t("dataTransparency.telemetry.title")}
					</h2>
					<p className="m-0">{t("dataTransparency.telemetry.body", { app })}</p>
				</section>
				<p className="m-0 text-muted text-sm">
					{renderRich(t("dataTransparency.more"), privacyLink)}
				</p>
			</div>
			<LegalLinks data-id="your-data-links" linkClassName={TEXT_LINK} />
		</article>
	);
}

/**
 * `/your-data`: where the data of the API client lives, what the proxy,
 * the server and the web server in front log, and that there is no telemetry; public, built from
 * `@localman/shared/data-policy`. Home while `secretVault` is off, since
 * its promise needs the vault.
 */
export function DataTransparencyPage() {
	const { secretVault } = useFeatures();
	if (!secretVault) return <Navigate to="/" replace />;
	return <DataTransparency />;
}
