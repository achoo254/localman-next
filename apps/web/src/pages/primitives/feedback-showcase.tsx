import { Alert } from "../../components/ui/alert";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { type ToastTone, useToast } from "../../components/ui/toast";
import { ShowcaseSection } from "./showcase-section";

const BADGE_TONES: ReadonlyArray<{ tone: BadgeTone; label: string }> = [
	{ tone: "neutral", label: "Nháp" },
	{ tone: "primary", label: "Pro" },
	{ tone: "accent", label: "Mới" },
	{ tone: "info", label: "Beta" },
	{ tone: "success", label: "Đang chạy" },
	{ tone: "warning", label: "Sắp hết hạn" },
	{ tone: "danger", label: "Lỗi" },
];

const TOASTS: ReadonlyArray<{ tone: ToastTone; label: string; title: string }> =
	[
		{ tone: "success", label: "Toast thành công", title: "Đã lưu project." },
		{ tone: "error", label: "Toast lỗi", title: "Không lưu được, thử lại." },
		{ tone: "info", label: "Toast thông tin", title: "Đã sao chép URL." },
	];

export function FeedbackShowcase() {
	const toast = useToast();
	return (
		<ShowcaseSection
			dataId="primitives-feedback"
			title="Phản hồi"
			description="Badge chữ mono in hoa, alert và toast dùng nền tint theo tông."
		>
			<div
				className="flex flex-wrap gap-2"
				data-id="primitives-feedback-badges"
			>
				{BADGE_TONES.map(({ tone, label }) => (
					<Badge key={tone} tone={tone}>
						{label}
					</Badge>
				))}
			</div>
			<div className="grid gap-3" data-id="primitives-feedback-alerts">
				<Alert tone="info" title="Mẹo">
					Mỗi resource tự sinh đủ 5 endpoint REST.
				</Alert>
				<Alert tone="success" title="Đã kết nối">
					Mock server đang phục vụ project này.
				</Alert>
				<Alert tone="warning" title="Sắp chạm hạn mức">
					Bạn đã dùng 9/10 resource của gói Free.
				</Alert>
				<Alert tone="danger" title="Không xoá được">
					Resource đang được endpoint khác tham chiếu.
				</Alert>
			</div>
			<div className="flex flex-wrap gap-3">
				{TOASTS.map(({ tone, label, title }) => (
					<Button
						key={tone}
						size="sm"
						data-id={`primitives-feedback-toast-${tone}`}
						onClick={() => toast.show({ tone, title })}
					>
						{label}
					</Button>
				))}
			</div>
		</ShowcaseSection>
	);
}
