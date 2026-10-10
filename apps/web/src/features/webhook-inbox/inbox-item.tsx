import { IconListNumbers, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { CopyField } from "../../components/ui/copy-field";
import { IconButton } from "../../components/ui/icon-button";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { missedTunnel } from "../mock-callbacks/delivery";
import { DeliveryAttempts } from "../mock-callbacks/delivery-attempts";
import { logTime } from "../request-log/request-log-row";
import { TunnelStatus } from "../upstream/tunnel-status";
import type { InboxView } from "./inbox-api";

export interface InboxItemProps {
	inbox: InboxView;
	manage: boolean;
	onShowLogs: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

const HELP = "m-0 text-muted text-sm";

/**
 * One inbox: name, the answer it gives, where it forwards, its request
 * count (a link to the request log), its URL and the last forward.
 */
export function InboxItem({
	inbox,
	manage,
	onShowLogs,
	onEdit,
	onDelete,
}: InboxItemProps) {
	const { t, formatDate } = useI18n();
	const { name, forward, lastForward, requestCount: count } = inbox;
	return (
		<li
			data-id={`inbox-item-${name}`}
			className="grid min-w-0 gap-3 rounded-md border border-border-subtle p-4"
		>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<span className="font-bold font-mono text-sm wrap-anywhere">
					{name}
				</span>
				<span className={`${HELP} font-mono`} data-id="inbox-item-response">
					{t("webhookInbox.item.response", {
						status: String(inbox.response.status),
						contentType: inbox.response.contentType,
					})}
				</span>
				<span className={`${HELP} wrap-anywhere`} data-id="inbox-item-target">
					{forward
						? renderRich(
								t("webhookInbox.item.forwards", { target: forward.target }),
							)
						: t("webhookInbox.item.noForward")}
				</span>
				<span className="ml-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						aria-label={t("webhookInbox.item.viewLog", { count, name })}
						leadingIcon={<IconListNumbers size={16} aria-hidden="true" />}
						onClick={onShowLogs}
						data-id="inbox-item-view-log"
					>
						{t("webhookInbox.item.requests", { count })}
					</Button>
					{manage ? (
						<>
							<IconButton
								label={t("webhookInbox.item.edit", { name })}
								icon={<IconPencil size={20} aria-hidden="true" />}
								onClick={onEdit}
								data-id="inbox-item-edit"
							/>
							<IconButton
								label={t("webhookInbox.item.delete", { name })}
								icon={<IconTrash size={20} aria-hidden="true" />}
								onClick={onDelete}
								data-id="inbox-item-delete"
							/>
						</>
					) : null}
				</span>
			</div>
			<CopyField
				label={t("webhookInbox.item.url")}
				hideLabel
				itemLabel={t("webhookInbox.item.urlItem", { name })}
				value={inbox.url}
				data-id="inbox-item-url"
				copyDataId="inbox-item-url-copy"
			/>
			{forward ? (
				<div className="grid gap-2" data-id="inbox-item-forward">
					<span className="font-mono font-semibold text-[0.8125rem]">
						{lastForward
							? t("webhookInbox.item.lastForwardAt", {
									time: `${formatDate(lastForward.at)} ${logTime(lastForward.at)}`,
								})
							: t("webhookInbox.item.lastForward")}
					</span>
					{lastForward && lastForward.attempts.length > 0 ? (
						<DeliveryAttempts
							attempts={lastForward.attempts}
							dataIdPrefix="inbox-item-attempts"
						/>
					) : (
						<p className={HELP}>{t("webhookInbox.item.noForwardYet")}</p>
					)}
					{missedTunnel(lastForward) ? (
						<TunnelStatus port={forward.port} url={null} scope="inbox-item" />
					) : null}
				</div>
			) : null}
		</li>
	);
}
