import { Link } from "react-router";
import { useFeatures } from "../../config/features";
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

const YOUR_DATA = {
	id: "your-data",
	to: LEGAL_PATHS.yourData,
	labelKey: "dataTransparency.nav",
} as const;

/**
 * "Privacy · Terms · Delete account", and "Your data" while the vault its
 * page promises is released: the footer and the legal pages.
 */
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
	const { secretVault } = useFeatures();
	const links = secretVault ? [...LINKS, YOUR_DATA] : LINKS;
	return (
		<nav
			aria-label={t("legal.nav.label")}
			data-id={dataId}
			className={cn("flex flex-wrap items-center gap-4", className)}
		>
			{links.map(({ id, to, labelKey }) => (
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
