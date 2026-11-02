import { IconLock } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** Shown to signed-in users who are not the Localman owner. */
export function AdminForbidden() {
	const t = useT();
	return (
		<EmptyState
			data-id="admin-forbidden"
			headingLevel={1}
			icon={<IconLock size={32} aria-hidden="true" />}
			title={t("admin.forbidden.title")}
			action={
				<Link
					to="/projects"
					data-id="admin-forbidden-back"
					className={cn(
						buttonClassName({ variant: "primary" }),
						"no-underline",
					)}
				>
					{t("admin.forbidden.back")}
				</Link>
			}
		>
			{t("admin.forbidden.body")}
		</EmptyState>
	);
}
