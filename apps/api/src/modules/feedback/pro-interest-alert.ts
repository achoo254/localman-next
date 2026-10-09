import type { ProInterestSubmission } from "@localman/shared";
import { maskEmail } from "../../lib/mask-email.js";
import type { ProInterestSaveOutcome } from "./pro-interest-store.js";

const HEADLINES: Readonly<Record<ProInterestSaveOutcome, string>> = {
	created: "Quan tâm gói Pro: đăng ký mới",
	updated: "Quan tâm gói Pro: cập nhật",
	recorded: "Quan tâm gói Pro: gửi lại từ người khác (chỉ lưu lịch sử)",
};

/** Short Telegram alert for the owner; no name, note or full email. */
export function proInterestAlertText(
	entry: Pick<ProInterestSubmission, "email" | "needs" | "teamSize" | "source">,
	outcome: ProInterestSaveOutcome,
): string {
	return [
		HEADLINES[outcome],
		`Email: ${maskEmail(entry.email)}`,
		`Nhu cầu: ${entry.needs.join(", ")}`,
		`Quy mô: ${entry.teamSize}`,
		`Nguồn: ${entry.source}`,
	].join("\n");
}
