import { IconSend } from "@tabler/icons-react";
import { Suspense, lazy, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { SuccessPanel } from "../../components/ui/success-panel";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { useCurrentUser } from "../auth/use-current-user";
import { FormSkeleton } from "./form-skeleton";
import type { ProInterestSource } from "./pro-interest-options";

// The form validates with the shared zod schema; load it (and zod) only
// when someone opens the modal, not with the landing or the header.
const ProInterestForm = lazy(async () => ({
	default: (await import("./pro-interest-form")).ProInterestForm,
}));

export interface ProInterestModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	source: ProInterestSource;
}

/** "Contact us about Pro": the interest form, then a confirmation. */
export function ProInterestModal({
	open,
	onOpenChange,
	source,
}: ProInterestModalProps) {
	const session = useCurrentUser();
	const t = useT();
	const formId = useId();
	const [busy, setBusy] = useState(false);
	const firstField = useRef<HTMLInputElement>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const user = session.status === "authenticated" ? session.user : null;

	const loading = <FormSkeleton data-id="pro-interest-loading" />;

	function changeOpen(next: boolean) {
		if (!next) setSentTo(null);
		onOpenChange(next);
	}

	const footer = sentTo ? (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="primary" data-id="pro-interest-close" autoFocus>
					{t("common.actions.close")}
				</Button>
			</ModalClose>
		</ModalFooter>
	) : (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="ghost" data-id="pro-interest-cancel">
					{t("common.actions.cancel")}
				</Button>
			</ModalClose>
			<Button
				type="submit"
				form={formId}
				variant="primary"
				loading={busy}
				data-id="pro-interest-submit"
				leadingIcon={<IconSend size={16} aria-hidden="true" />}
			>
				{t("subscription.proInterest.submit")}
			</Button>
		</ModalFooter>
	);

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title={t("subscription.proInterest.title")}
			size="md"
			initialFocusRef={firstField}
			data-id="modal-pro-interest"
			footer={footer}
		>
			{sentTo ? (
				<output className="block">
					<SuccessPanel
						title={t("subscription.proInterest.successTitle")}
						data-id="pro-interest-success"
					>
						{/* The email goes in through the renderer, never parsed as tags. */}
						{renderRich(
							t("subscription.proInterest.successText", { email: "" }),
							{
								b: () => <b>{sentTo}</b>,
							},
						)}
					</SuccessPanel>
				</output>
			) : session.status === "loading" ? (
				loading
			) : (
				<Suspense fallback={loading}>
					<ProInterestForm
						key={user?.sub ?? "visitor"}
						formId={formId}
						firstFieldRef={firstField}
						source={source}
						signedIn={user !== null}
						accountEmail={user?.email ?? null}
						onBusyChange={setBusy}
						onSubmitted={setSentTo}
					/>
				</Suspense>
			)}
		</Modal>
	);
}
