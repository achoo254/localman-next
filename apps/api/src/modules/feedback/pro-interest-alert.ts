import type { ProInterestSubmission } from "@localman/shared";
import type { ProInterestSaveOutcome } from "./pro-interest-store.js";

const VISIBLE = 2;

function maskPart(part: string): string {
	return `${part.slice(0, VISIBLE)}***`;
}

/**
 * Hides most of an address for chat alerts: `nguyen@gmail.com` becomes
 * `ng***@gm***.com`. The top-level domain stays readable.
 */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	if (at <= 0) return "***";
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const dot = domain.lastIndexOf(".");
	const masked =
		dot > 0
			? `${maskPart(domain.slice(0, dot))}${domain.slice(dot)}`
			: maskPart(domain);
	return `${maskPart(local)}@${masked}`;
}

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
