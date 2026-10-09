import { IconCheck, IconHistory, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../i18n/i18n-context";
import { EmailMatchBadge } from "./email-match-badge";
import type { ProInterestItem } from "./pro-interest-item";
import {
	CELL,
	maskEmail,
	needsLabel,
	sourceLabel,
	teamLabel,
} from "./pro-interest-labels";
import { SubmissionHistory } from "./submission-history";

export const COLUMN_COUNT = 7;

export interface ProInterestRowProps {
	item: ProInterestItem;
	pending: boolean;
	onToggleContacted: (item: ProInterestItem) => void;
	onDelete: (item: ProInterestItem) => void;
}

/** One sign-up, with its submission history folded underneath. */
export function ProInterestRow({
	item,
	pending,
	onToggleContacted,
	onDelete,
}: ProInterestRowProps) {
	const { t, formatDate } = useI18n();
	const [open, setOpen] = useState(false);
	const rowId = `admin-pro-row-${item.id}`;
	const emailId = `${rowId}-email`;
	const contacted = item.contactedAt !== null;
	return (
		<>
			<tr data-id={rowId}>
				<td id={emailId} className={`${CELL} whitespace-nowrap`}>
					<span className="grid justify-items-start gap-1">
						<span className="font-mono text-[0.8125rem]">
							{maskEmail(item.email)}
						</span>
						<EmailMatchBadge matches={item.emailMatchesAccount} />
					</span>
				</td>
				<td className={CELL}>{needsLabel(t, item.needs)}</td>
				<td className={`${CELL} whitespace-nowrap`}>
					{teamLabel(t, item.teamSize)}
				</td>
				<td className={CELL}>{sourceLabel(t, item.source)}</td>
				<td className={`${CELL} whitespace-nowrap font-mono text-[0.8125rem]`}>
					{formatDate(item.createdAt)}
				</td>
				<td className={CELL}>
					<Badge
						tone={contacted ? "success" : "accent"}
						data-id={`${rowId}-status`}
					>
						{contacted ? t("admin.pro.contacted") : t("admin.pro.notContacted")}
					</Badge>
				</td>
				<td className={CELL}>
					<span className="flex flex-wrap gap-1">
						<Button
							size="sm"
							variant={contacted ? "ghost" : "secondary"}
							disabled={pending}
							aria-describedby={emailId}
							data-id={`${rowId}-contacted`}
							leadingIcon={
								contacted ? null : <IconCheck size={16} aria-hidden="true" />
							}
							onClick={() => onToggleContacted(item)}
						>
							{contacted ? t("admin.pro.unmark") : t("admin.pro.markContacted")}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							aria-expanded={open}
							aria-controls={`${rowId}-history`}
							aria-describedby={emailId}
							data-id={`${rowId}-history-toggle`}
							leadingIcon={<IconHistory size={16} aria-hidden="true" />}
							onClick={() => setOpen((value) => !value)}
						>
							{t("admin.pro.history", { count: item.submissions.length })}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							aria-describedby={emailId}
							data-id={`${rowId}-delete`}
							leadingIcon={<IconTrash size={16} aria-hidden="true" />}
							onClick={() => onDelete(item)}
						>
							{t("admin.pro.deleteTitle")}
						</Button>
					</span>
				</td>
			</tr>
			<tr id={`${rowId}-history`} hidden={!open}>
				<td colSpan={COLUMN_COUNT} className={`${CELL} bg-surface-subtle`}>
					{open ? (
						<SubmissionHistory
							entries={item.submissions}
							dataId={`${rowId}-history`}
						/>
					) : null}
				</td>
			</tr>
		</>
	);
}
