import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { IconCircleCheck, IconLock } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { FormField } from "../../components/ui/form-field";
import { Textarea } from "../../components/ui/textarea";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { requestElementAccess } from "./sharing-api";
import { errorCodeOf, sharingErrorMessage } from "./sharing-errors";
import {
	ELEMENT_ROLE_CHOICES,
	elementKey,
	elementRoleLabel,
} from "./use-element-access";

export const MAX_REQUEST_MESSAGE = 500;

/** What each role allows, per element type. */
const ROLE_HINTS = {
	collection: {
		viewer: "sharing.request.collectionViewer",
		editor: "sharing.request.collectionEditor",
	},
	environment: {
		viewer: "sharing.request.environmentViewer",
		editor: "sharing.request.environmentEditor",
	},
} as const;

const RADIO_CARD =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-primary has-checked:bg-primary/6 has-focus-visible:outline-2 has-focus-visible:outline-primary";

function BackLink() {
	const t = useT();
	return (
		<Link
			to="/api-client"
			data-id="request-access-back"
			className={cn(buttonClassName({ block: true }), "no-underline")}
		>
			{t("sharing.request.back")}
		</Link>
	);
}

/**
 * "You don't have access": ask for Viewer or Editor with a message. The
 * page never names the element (the API answers 404 to hide it), and the
 * API answers "sent" whether or not it exists.
 */
export function RequestAccessForm({
	elementType,
	elementId,
}: {
	elementType: ShareableElementType;
	elementId: string;
}) {
	const t = useT();
	const [params] = useSearchParams();
	const [role, setRole] = useState<ElementRole>(
		params.get("role") === "editor" ? "editor" : "viewer",
	);
	const [message, setMessage] = useState("");
	const client = useQueryClient();
	const sentHeading = useRef<HTMLHeadingElement>(null);
	const send = useMutation({
		mutationFn: () =>
			requestElementAccess(elementType, elementId, role, message),
		onError: (error) => {
			// They can open it after all: load it again so the page shows it.
			if (errorCodeOf(error) === "ALREADY_HAS_ACCESS") {
				void client.invalidateQueries({
					queryKey: elementKey(elementType, elementId),
				});
			}
		},
	});
	const hasAccess = errorCodeOf(send.error) === "ALREADY_HAS_ACCESS";
	// The form is replaced: tell screen readers where they are now.
	useEffect(() => {
		if (send.isSuccess) sentHeading.current?.focus();
	}, [send.isSuccess]);

	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="request-access-page"
				className="mx-auto grid w-full max-w-md gap-4 p-6"
			>
				{send.isSuccess ? (
					<>
						<IconCircleCheck
							size={32}
							aria-hidden="true"
							className="text-success"
						/>
						<h1
							ref={sentHeading}
							tabIndex={-1}
							className="m-0 font-bold font-mono text-xl"
						>
							{t("sharing.request.sentTitle")}
						</h1>
						<p className="m-0 text-sm" data-id="request-access-sent">
							{t("sharing.request.sent")}
						</p>
						<BackLink />
					</>
				) : (
					<form
						noValidate
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							send.mutate();
						}}
					>
						<IconLock
							size={32}
							aria-hidden="true"
							className="text-icon-muted"
						/>
						<h1 className="m-0 font-bold font-mono text-xl">
							{t("sharing.request.title")}
						</h1>
						<p className="m-0 text-muted text-sm">
							{t("sharing.request.text")}
						</p>
						<fieldset className="m-0 grid gap-2 border-0 p-0">
							<legend className="sr-only">{t("sharing.request.legend")}</legend>
							{ELEMENT_ROLE_CHOICES.map((choice) => (
								<label
									key={choice}
									className={RADIO_CARD}
									data-id={`request-access-${choice}`}
								>
									<input
										type="radio"
										name="request-access-role"
										value={choice}
										checked={role === choice}
										onChange={() => setRole(choice)}
										className="mt-1 size-4 accent-primary-solid"
									/>
									<span className="grid gap-0.5">
										<b className="font-mono text-sm">
											{elementRoleLabel(choice, t)}
										</b>
										<span className="text-muted text-[0.8125rem]">
											{t(ROLE_HINTS[elementType][choice])}
										</span>
									</span>
								</label>
							))}
						</fieldset>
						<FormField
							label={`${t("sharing.request.message")} ${t("common.optional")}`}
							hint={t("sharing.request.messageHint")}
						>
							<Textarea
								value={message}
								rows={3}
								maxLength={MAX_REQUEST_MESSAGE}
								data-id="request-access-message"
								onChange={(event) => setMessage(event.target.value)}
							/>
						</FormField>
						{send.error ? (
							<Alert
								tone={hasAccess ? "info" : "danger"}
								data-id="request-access-error"
							>
								{sharingErrorMessage(send.error, t)}
							</Alert>
						) : null}
						<Button
							type="submit"
							variant="primary"
							block
							loading={send.isPending}
							data-id="request-access-submit"
						>
							{t("sharing.request.submit")}
						</Button>
						{hasAccess ? <BackLink /> : null}
					</form>
				)}
			</Card>
		</div>
	);
}
