import { IconLock } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { AuthStatus } from "../../features/auth/auth-status";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";
import { AdminNav } from "./admin-nav";
import {
	type ProInterestStats,
	fetchStats,
	isForbidden,
} from "./pro-interest-admin-api";
import { ProInterestList } from "./pro-interest-list";
import { ProInterestStatsView } from "./pro-interest-stats";

type StatsState =
	| { status: "loading" }
	| { status: "ready"; stats: ProInterestStats }
	| { status: "error"; error: unknown };

/** Shown to signed-in users who are not the Localman owner. */
export function AdminForbidden() {
	const t = useT();
	return (
		<EmptyState
			data-id="admin-pro-forbidden"
			headingLevel={1}
			icon={<IconLock size={32} aria-hidden="true" />}
			title={t("admin.forbidden.title")}
			action={
				<Link
					to="/projects"
					data-id="admin-pro-forbidden-back"
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

/** `/admin/pro-interest`: who wants Pro, from where, and follow-up status. */
export function ProInterestPage() {
	const t = useT();
	useAppTitle(t("admin.heading", { page: t("admin.nav.proInterest") }));
	const session = useCurrentUser();
	// The signed-in shell normally resolves the session first; never flash
	// the 403 page while it is still loading.
	if (session.status !== "authenticated") return <AuthStatus kind="loading" />;
	if (!session.user.isOwner) return <AdminForbidden />;
	return <ProInterestDashboard />;
}

function ProInterestDashboard() {
	const t = useT();
	const [stats, setStats] = useState<StatsState>({ status: "loading" });
	const [forbidden, setForbidden] = useState(false);

	const loadStats = useCallback(async () => {
		try {
			setStats({ status: "ready", stats: await fetchStats() });
		} catch (error) {
			if (isForbidden(error)) setForbidden(true);
			setStats({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void loadStats();
	}, [loadStats]);

	if (forbidden) return <AdminForbidden />;

	return (
		<section data-id="admin-pro" className="grid gap-4">
			<div className="flex min-h-11 flex-wrap items-center gap-3">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("admin.heading", { page: t("admin.nav.proInterest") })}
				</h1>
				<Badge tone="accent">{t("admin.ownerOnly")}</Badge>
			</div>
			<AdminNav />
			{stats.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					{t("admin.pro.statsLoading")}
				</output>
			) : null}
			{stats.status === "error" ? (
				<div className="grid justify-items-start gap-3">
					<Alert tone="danger" title={t("admin.pro.statsFailed")}>
						{errorMessage(stats.error)}
					</Alert>
					<Button onClick={() => void loadStats()}>
						{t("common.cta.retry")}
					</Button>
				</div>
			) : null}
			{stats.status === "ready" ? (
				<ProInterestStatsView stats={stats.stats} />
			) : null}
			<ProInterestList
				onChanged={() => void loadStats()}
				onForbidden={() => setForbidden(true)}
			/>
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("admin.pro.footnote")}
			</p>
		</section>
	);
}
