import { Navigate } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";
import { useVnFakeData } from "./use-vn-fake-data";
import { VnFakeDataForm } from "./vn-fake-data-form";
import { VnFakeDataNudge } from "./vn-fake-data-nudge";
import { VnFakeDataPreview } from "./vn-fake-data-preview";

function VnFakeDataTool() {
	const t = useT();
	const state = useVnFakeData();
	useAppTitle(t("vnFakeData.meta.title"));
	return (
		<div data-id="vn-fake-data" className="grid min-w-0 gap-6 py-8">
			<header className="grid gap-3">
				<Badge tone="primary" className="w-fit">
					{t("vnFakeData.page.badge")}
				</Badge>
				<h1 className="m-0 font-bold text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-[-0.02em]">
					{t("vnFakeData.page.title")}
				</h1>
				<p className="m-0 max-w-3xl text-lg text-muted">
					{t("vnFakeData.page.intro")}
				</p>
			</header>
			<Alert
				tone="info"
				title={t("vnFakeData.notice.title")}
				data-id="vn-fake-data-notice"
			>
				{t("vnFakeData.notice.text")}
			</Alert>
			<VnFakeDataForm state={state} />
			<VnFakeDataPreview type={state.type} records={state.records} />
			<VnFakeDataNudge />
		</div>
	);
}

/**
 * `/tools/vn-fake-data`: Vietnamese fake data generated in the browser,
 * public and prerendered for search engines. Home while `vnFakeData` is
 * off.
 */
export function VnFakeDataPage() {
	const { vnFakeData } = useFeatures();
	if (!vnFakeData) return <Navigate to="/" replace />;
	return <VnFakeDataTool />;
}
