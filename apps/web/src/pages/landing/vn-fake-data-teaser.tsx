import { IconArrowRight, IconId } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** Landing link to the public Vietnamese fake data tool (`vnFakeData`). */
export function VnFakeDataTeaser() {
	const t = useT();
	return (
		<section
			data-id="landing-vn-fake-data"
			aria-labelledby="landing-vn-fake-data-title"
			className={cn(
				cardClassName,
				"my-8 flex flex-wrap items-center justify-between gap-4 p-6",
			)}
		>
			<div className="flex min-w-0 items-start gap-3">
				<IconId
					size={24}
					aria-hidden="true"
					className="shrink-0 text-primary"
				/>
				<div className="grid min-w-0 gap-1">
					<h2 id="landing-vn-fake-data-title" className="m-0 font-bold text-lg">
						{t("vnFakeData.landing.title")}
					</h2>
					<p className="m-0 text-muted text-sm">
						{t("vnFakeData.landing.text")}
					</p>
				</div>
			</div>
			<Link
				to="/tools/vn-fake-data"
				data-id="landing-vn-fake-data-link"
				className={cn(
					buttonClassName({ variant: "secondary" }),
					"no-underline",
				)}
			>
				{t("vnFakeData.landing.link")}
				<IconArrowRight size={16} aria-hidden="true" />
			</Link>
		</section>
	);
}
