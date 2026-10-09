import { Badge } from "../../components/ui/badge";

/** Whether the address was the signed-in account's own (verified) email. */
export function EmailMatchBadge({ matches }: { matches: boolean }) {
	return matches ? (
		<Badge tone="success">Email khớp tài khoản</Badge>
	) : (
		<Badge tone="warning">Chưa xác minh</Badge>
	);
}
