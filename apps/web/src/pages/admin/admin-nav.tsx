import { NavLink } from "react-router";
import { cn } from "../../lib/cn";

const PAGES = [
	{ to: "/admin/pro-interest", label: "Quan tâm gói Pro", id: "pro-interest" },
	{ to: "/admin/feedback", label: "Hộp thư góp ý", id: "feedback" },
] as const;

/** Links between the owner's admin pages. */
export function AdminNav() {
	return (
		<nav aria-label="Trang quản trị" data-id="admin-nav">
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
							{page.label}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
