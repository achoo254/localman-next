import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { DEMO_USERS, demoMockBaseUrl } from "../../content/landing-samples";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useTenantInfo } from "../../lib/tenant-info";

const LOCALHOST_ORDERS = [
	{ id: "1042", status: "paid", total: 259000 },
	{ id: "1041", status: "pending", total: 87000 },
];

interface PreviewProps {
	url: string;
	body: string;
	chip?: string;
	footer: string;
}

function PreviewCard({ url, body, chip, footer }: PreviewProps) {
	return (
		<figure
			data-id="landing-hero-preview"
			className={cn(cardClassName, "m-0 grid min-w-0 overflow-hidden")}
		>
			<figcaption className="flex min-w-0 items-center gap-2 border-border-subtle border-b px-4 py-3">
				<Badge tone="success">GET</Badge>
				<code className="min-w-0 overflow-x-auto whitespace-nowrap text-[0.8125rem] text-muted">
					{url}
				</code>
				{chip ? (
					<Badge tone="accent" data-id="landing-hero-preview-tunnel">
						{chip}
					</Badge>
				) : null}
			</figcaption>
			<pre className="m-0 max-h-80 overflow-auto bg-surface-subtle px-4 py-3 text-[0.8125rem] leading-[1.6]">
				<code>{body}</code>
			</pre>
			<p className="m-0 flex flex-wrap gap-3 border-border-subtle border-t px-4 py-2 font-mono text-muted text-xs">
				<span className="font-semibold text-success-text">200 OK</span>
				<span>{footer}</span>
			</p>
		</figure>
	);
}

/**
 * Static request/response card next to the hero copy. Illustrative only:
 * the URL secret is a placeholder and no timing is shown, since nothing is
 * measured here.
 */
export function HeroPreview({ localhost }: { localhost: boolean }) {
	const t = useT();
	const baseUrl = demoMockBaseUrl(useTenantInfo().mockBaseDomain);
	if (localhost) {
		return (
			<PreviewCard
				url="http://localhost:3000/api/orders?limit=2"
				body={JSON.stringify(LOCALHOST_ORDERS, null, 2)}
				chip={t("landing.preview.viaTunelo")}
				footer={t("landing.preview.tunnelFound")}
			/>
		);
	}
	const users = DEMO_USERS.slice(0, 2).map(({ id, name, email }) => ({
		id,
		name,
		email,
	}));
	return (
		<PreviewCard
			url={`${baseUrl}/users?page=1&limit=2`}
			body={JSON.stringify(users, null, 2)}
			footer={t("landing.preview.records", { count: users.length })}
		/>
	);
}
