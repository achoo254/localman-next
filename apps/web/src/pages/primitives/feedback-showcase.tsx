import { Alert } from "../../components/ui/alert";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { type ToastTone, useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/message-types";
import { ShowcaseSection } from "./showcase-section";

type BadgeKey = keyof Messages["primitives"]["feedback"]["badges"];

const BADGE_TONES: ReadonlyArray<{ tone: BadgeTone; key: BadgeKey }> = [
	{ tone: "neutral", key: "draft" },
	{ tone: "primary", key: "shared" },
	{ tone: "accent", key: "fresh" },
	{ tone: "info", key: "beta" },
	{ tone: "success", key: "running" },
	{ tone: "warning", key: "expiring" },
	{ tone: "danger", key: "failed" },
];

const TOASTS = [
	{ tone: "success", key: "toastSuccess" },
	{ tone: "error", key: "toastError" },
	{ tone: "info", key: "toastInfo" },
] as const satisfies ReadonlyArray<{ tone: ToastTone; key: string }>;

export function FeedbackShowcase() {
	const t = useT();
	const toast = useToast();
	return (
		<ShowcaseSection
			dataId="primitives-feedback"
			title={t("primitives.feedback.title")}
			description={t("primitives.feedback.description")}
		>
			<div
				className="flex flex-wrap gap-2"
				data-id="primitives-feedback-badges"
			>
				{BADGE_TONES.map(({ tone, key }) => (
					<Badge key={tone} tone={tone}>
						{t(`primitives.feedback.badges.${key}`)}
					</Badge>
				))}
			</div>
			<div className="grid gap-3" data-id="primitives-feedback-alerts">
				<Alert tone="info" title={t("primitives.feedback.tipTitle")}>
					{t("primitives.feedback.tipBody")}
				</Alert>
				<Alert tone="success" title={t("primitives.feedback.connectedTitle")}>
					{t("primitives.feedback.connectedBody")}
				</Alert>
				<Alert tone="warning" title={t("primitives.feedback.limitTitle")}>
					{t("primitives.feedback.limitBody")}
				</Alert>
				<Alert tone="danger" title={t("primitives.feedback.deleteFailedTitle")}>
					{t("primitives.feedback.deleteFailedBody")}
				</Alert>
			</div>
			<div className="flex flex-wrap gap-3">
				{TOASTS.map(({ tone, key }) => (
					<Button
						key={tone}
						size="sm"
						data-id={`primitives-feedback-toast-${tone}`}
						onClick={() =>
							toast.show({ tone, title: t(`primitives.feedback.${key}Title`) })
						}
					>
						{t(`primitives.feedback.${key}`)}
					</Button>
				))}
			</div>
		</ShowcaseSection>
	);
}
