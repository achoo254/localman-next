import { NavLink } from "react-router";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const PAGES = [
	{ to: "/admin/pro-interest", key: "proInterest", id: "pro-interest" },
	{ to: "/admin/feedback", key: "feedback", id: "feedback" },
	{
		to: "/admin/trial-extensions",
		key: "trialExtensions",
		id: "trial-extensions",
	},
] as const;

/** Links between the owner's admin pages. */
export function AdminNav() {
	const t = useT();
	return (
		<nav aria-label={t("admin.nav.label")} data-id="admin-nav">
			<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
				{PAGES.map((page) => (
					<li key={page.id}>
						<NavLink
							to={page.to}
							end
							data-id={`admin-nav-${page.id}`}
							className={({ isActive }) =>
								cn(
									"inline-flex min-h-10 items-center pointer-coarse:min-h-11 rounded-sm border px-3 font-mono font-semibold text-[0.8125rem] no-underline",
									isActive
										? "border-primary text-primary"
										: "border-border-subtle text-muted hover:text-fg",
								)
							}
						>
							{t(`admin.nav.${page.key}`)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
