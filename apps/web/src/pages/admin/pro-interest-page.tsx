import { IconLock } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { AuthStatus } from "../../features/auth/auth-status";
import { useCurrentUser } from "../../features/auth/use-current-user";
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
	return (
		<EmptyState
			data-id="admin-pro-forbidden"
			headingLevel={1}
			icon={<IconLock size={32} aria-hidden="true" />}
			title="403 · Chỉ owner xem được trang này"
			action={
				<Link
					to="/projects"
					data-id="admin-pro-forbidden-back"
					className={cn(
						buttonClassName({ variant: "primary" }),
						"no-underline",
					)}
				>
					Về Projects
				</Link>
			}
		>
			Trang quản trị chỉ dành cho người vận hành Localman.
		</EmptyState>
	);
}

/** `/admin/pro-interest`: who wants Pro, from where, and follow-up status. */
export function ProInterestPage() {
	useAppTitle("Quản trị · Quan tâm gói Pro");
	const session = useCurrentUser();
	// The signed-in shell normally resolves the session first; never flash
	// the 403 page while it is still loading.
	if (session.status !== "authenticated") return <AuthStatus kind="loading" />;
	if (!session.user.isOwner) return <AdminForbidden />;
	return <ProInterestDashboard />;
}

function ProInterestDashboard() {
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
					Quản trị · Quan tâm gói Pro
				</h1>
				<Badge tone="accent">Chỉ chủ sở hữu</Badge>
			</div>
			<AdminNav />
			{stats.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					Đang tải thống kê…
				</output>
			) : null}
			{stats.status === "error" ? (
				<div className="grid justify-items-start gap-3">
					<Alert tone="danger" title="Không tải được thống kê">
						{errorMessage(stats.error)}
					</Alert>
					<Button onClick={() => void loadStats()}>Thử lại</Button>
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
				Email trong bảng được che một phần; file CSV có email đầy đủ để owner tự
				liên hệ. Mỗi đăng ký mới, bot Telegram báo về chat của owner.
			</p>
		</section>
	);
}
