import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { ApiError } from "../../lib/api-client";
import type { CurrentUser } from "../auth/current-user";
import { invitePageErrorMessage } from "./invite-errors";
import { InviteInvalid, tokenErrorOf } from "./invite-invalid";
import { InvitePreviewCard } from "./invite-preview-card";
import {
	type IneligibleReason,
	type InvitePreview,
	acceptInvite,
	previewInvite,
} from "./invites-api";

type View =
	| { status: "loading" }
	| { status: "ready"; preview: InvitePreview }
	| { status: "failed"; error: unknown };

/** Accept refusals that mean the same as a preview `reason`. */
function refusalOf(error: unknown): IneligibleReason | null {
	if (!(error instanceof ApiError)) return null;
	if (error.code === "NOT_INVITEE" || error.code === "EMAIL_NOT_VERIFIED") {
		return error.code;
	}
	return error.code === "PLAN_LIMIT_REACHED" ? "MEMBER_LIMIT" : null;
}

/**
 * Signed-in part of `/invite/:token`: preview the token, then accept and
 * go to the project. Each state has one h1, focused when the state changes
 * so screen readers hear the new situation.
 */
export function InviteDetails({
	token,
	user,
}: {
	token: string;
	user: CurrentUser;
}) {
	const navigate = useNavigate();
	const toast = useToast();
	const [view, setView] = useState<View>({ status: "loading" });
	const [accepting, setAccepting] = useState(false);
	const [acceptError, setAcceptError] = useState<unknown>(null);
	const root = useRef<HTMLDivElement>(null);

	const load = useCallback(async () => {
		setView({ status: "loading" });
		setAcceptError(null);
		try {
			setView({ status: "ready", preview: await previewInvite(token) });
		} catch (error) {
			setView({ status: "failed", error });
		}
	}, [token]);

	useEffect(() => {
		void load();
	}, [load]);

	async function accept(preview: InvitePreview) {
		setAccepting(true);
		setAcceptError(null);
		try {
			const done = await acceptInvite(token);
			toast.show({
				title: done.alreadyMember
					? `Bạn đã là thành viên của ${preview.project.name}`
					: `Đã tham gia ${preview.project.name}`,
			});
			navigate(`/projects/${encodeURIComponent(done.projectId)}`, {
				replace: true,
			});
		} catch (error) {
			if (tokenErrorOf(error)) setView({ status: "failed", error });
			else setAcceptError(error);
			setAccepting(false);
		}
	}

	const refusal = refusalOf(acceptError);
	const key =
		view.status === "ready"
			? `ready-${refusal ?? view.preview.reason ?? "ok"}`
			: view.status;
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the visible state; focus its h1 whenever it changes.
	useEffect(() => {
		const heading = root.current?.querySelector("h1");
		if (!heading) return;
		heading.tabIndex = -1;
		heading.focus();
	}, [key]);

	let body: ReactNode;
	if (view.status === "loading") {
		body = (
			<output
				data-id="invite-page-loading"
				className="block py-16 text-center font-mono text-muted text-sm"
			>
				Đang kiểm tra lời mời…
			</output>
		);
	} else if (view.status === "ready") {
		body = (
			<InvitePreviewCard
				preview={view.preview}
				user={user}
				reason={refusal ?? view.preview.reason}
				accepting={accepting}
				acceptError={refusal ? null : acceptError}
				onAccept={() => void accept(view.preview)}
			/>
		);
	} else {
		const code = tokenErrorOf(view.error);
		body = code ? (
			<InviteInvalid code={code} error={view.error} />
		) : (
			<Card className="mx-auto grid w-full max-w-md gap-4 p-6">
				<h1 className="m-0 font-bold font-mono text-xl">
					Không mở được lời mời
				</h1>
				<Alert tone="danger" data-id="invite-page-error">
					{invitePageErrorMessage(view.error)}
				</Alert>
				<Button data-id="invite-page-retry" onClick={() => void load()}>
					Thử lại
				</Button>
			</Card>
		);
	}
	return (
		<div ref={root} className="py-8 md:py-16">
			{body}
		</div>
	);
}
