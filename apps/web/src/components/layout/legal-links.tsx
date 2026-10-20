import { Link } from "react-router";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LEGAL_PATHS } from "../../lib/legal";

const LINKS = [
	{ id: "privacy", to: LEGAL_PATHS.privacy, labelKey: "legal.nav.privacy" },
	{ id: "terms", to: LEGAL_PATHS.terms, labelKey: "legal.nav.terms" },
	{
		id: "delete-account",
		to: LEGAL_PATHS.accountDelete,
		labelKey: "legal.nav.deleteAccount",
	},
] as const;

/** "Privacy · Terms · Delete account": the footer and the legal pages. */
export function LegalLinks({
	linkClassName,
	className,
	"data-id": dataId,
}: {
	linkClassName: string;
	className?: string;
	"data-id": string;
}) {
	const t = useT();
	return (
		<nav
			aria-label={t("legal.nav.label")}
			data-id={dataId}
			className={cn("flex flex-wrap items-center gap-4", className)}
		>
			{LINKS.map(({ id, to, labelKey }) => (
				<Link
					key={id}
					to={to}
					data-id={`${dataId}-${id}`}
					className={linkClassName}
				>
					{t(labelKey)}
				</Link>
			))}
		</nav>
	);
}
