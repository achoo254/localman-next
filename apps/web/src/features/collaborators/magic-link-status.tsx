import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { formatDate } from "../../lib/format";
import { DANGER_GHOST } from "./collaborators-footer";
import type { MagicLinkState } from "./magic-link-api";

const HELP = "m-0 text-muted text-[0.8125rem]";

export interface MagicLinkStatusProps {
	link: MagicLinkState;
	onRevoke: () => void;
}

/**
 * State of a link that is no longer shown: active (with "Thu hồi") or
 * expired; "Chưa có" for none and revoked.
 */
export function MagicLinkStatus({ link, onRevoke }: MagicLinkStatusProps) {
	if (link.status === "none" || link.status === "revoked") {
		return <p className={HELP}>Chưa có magic link đang hoạt động.</p>;
	}
	const active = link.status === "active";
	const expires = link.expiresAt ? formatDate(link.expiresAt) : "";
	return (
		<div
			data-id="modal-magic-link-status"
			className="grid gap-2 rounded-md border border-border-subtle px-3 py-2"
		>
			<div className="flex flex-wrap items-center gap-2 font-mono text-[0.8125rem]">
				{active ? (
					<Badge tone="success">Đang hoạt động</Badge>
				) : (
					<Badge tone="neutral">Đã hết hạn</Badge>
				)}
				<span>Hết hạn {expires}</span>
				{link.createdAt ? (
					<span className="text-muted">
						· Tạo lúc {formatDate(link.createdAt)}
					</span>
				) : null}
			</div>
			{active ? (
				<>
					<p className={HELP}>
						Vì lý do bảo mật, link không hiển thị lại. Tạo link mới nếu cần gửi
						lại.
					</p>
					<Button
						variant="ghost"
						size="sm"
						data-id="modal-magic-link-revoke"
						className={`justify-self-start ${DANGER_GHOST}`}
						onClick={onRevoke}
					>
						Thu hồi
					</Button>
				</>
			) : null}
		</div>
	);
}
