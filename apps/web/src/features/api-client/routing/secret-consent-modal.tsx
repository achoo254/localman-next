import { IconLock, IconSend } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";
import type { SecretAsk } from "./route-types";

export interface ConsentAnswer {
	send: boolean;
	/** Stop asking for this host (only meaningful with `send`). */
	remember: boolean;
}

export interface SecretConsentModalProps {
	/** The pending question; `null` keeps the modal closed. */
	ask: SecretAsk | null;
	onAnswer: (answer: ConsentAnswer) => void;
}

function reasonKey(ask: SecretAsk) {
	if (ask.route === "tunelo") return "tunnel" as const;
	switch (ask.why) {
		case "pinned":
		case "forbidden":
		case "redirects":
		case "remembered":
			return ask.why;
		// Proxy not set on the tab: the account's default route.
		case "manual":
			return "defaultRoute" as const;
		default:
			return "cors" as const;
	}
}

/**
 * Asked before a request carrying credentials switches to the proxy (or a
 * tunnel, which the proxy calls) on its own. Cancel and Esc decline.
 */
export function SecretConsentModal({ ask, onAnswer }: SecretConsentModalProps) {
	const t = useT();
	const [remember, setRemember] = useState(false);
	const rememberId = useId();
	const cancel = useRef<HTMLButtonElement>(null);
	// Each question starts unticked, even when the last one was dropped
	// (its tab closed) without an answer.
	useEffect(() => {
		if (ask) setRemember(false);
	}, [ask]);
	const answer = (send: boolean) => {
		onAnswer({ send, remember: send && remember });
		setRemember(false);
	};
	return (
		<Modal
			open={ask !== null}
			onOpenChange={(open) => {
				if (!open) answer(false);
			}}
			title={t("apiClientRouting.consent.title")}
			size="md"
			initialFocusRef={cancel}
			data-id="modal-route-secret"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button
							ref={cancel}
							variant="ghost"
							data-id="modal-route-secret-cancel"
						>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-route-secret-confirm"
						onClick={() => answer(true)}
					>
						<IconSend size={16} aria-hidden="true" />
						{t("apiClientRouting.consent.confirm")}
					</Button>
				</ModalFooter>
			}
		>
			{ask ? (
				<div className="grid gap-3 text-sm">
					<p className="m-0">
						{t("apiClientRouting.consent.body", {
							target: ask.target,
							reason: t(`apiClientRouting.consent.reason.${reasonKey(ask)}`),
							parts: ask.parts.join(", "),
						})}
					</p>
					<p
						className="m-0 break-all font-mono text-xs"
						data-id="modal-route-secret-destination"
					>
						{t("apiClientRouting.consent.destination", { url: ask.url })}
					</p>
					<Alert
						tone="warning"
						title={
							<span className="inline-flex items-center gap-1">
								<IconLock size={16} aria-hidden="true" />
								{t("apiClientRouting.consent.note")}
							</span>
						}
						data-id="modal-route-secret-note"
					>
						<p className="m-0 text-xs">
							{t("apiClientRouting.consent.noteBody")}
						</p>
					</Alert>
					<label htmlFor={rememberId} className="flex items-center gap-2">
						<input
							id={rememberId}
							type="checkbox"
							checked={remember}
							data-id="modal-route-secret-remember"
							className="size-4 accent-primary"
							onChange={(event) => setRemember(event.target.checked)}
						/>
						{t("apiClientRouting.consent.remember", { host: ask.host })}
					</label>
					<p className="m-0 text-muted text-xs">
						{t("apiClientRouting.consent.hint")}
					</p>
				</div>
			) : null}
		</Modal>
	);
}
