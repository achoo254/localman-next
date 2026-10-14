import { IconCircleCheck } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import type { RunButtonImportResult } from "../../features/public-sharing/run-buttons-api";
import { elementPath } from "../../features/sharing/sharing-api";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/**
 * Step 4: the collection is in the workspace. A link opens it there; an
 * environment that could not be created is a warning, not a failure.
 */
export function RunImportDone({
	name,
	result,
}: {
	name: string;
	result: RunButtonImportResult;
}) {
	const t = useT();
	const heading = useRef<HTMLHeadingElement>(null);
	// The form was replaced: tell screen readers where they are now.
	useEffect(() => heading.current?.focus(), []);
	const target = result.collectionId
		? elementPath("collection", result.collectionId)
		: "/api-client";
	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="run-import-done"
				className="mx-auto grid w-full max-w-md gap-4 p-6"
			>
				<IconCircleCheck
					size={32}
					aria-hidden="true"
					className="text-success"
				/>
				<h1
					ref={heading}
					tabIndex={-1}
					className="m-0 font-bold font-mono text-xl"
				>
					{t("publicSharing.view.run.doneTitle")}
				</h1>
				<p className="m-0 break-words text-sm">
					{t("publicSharing.view.run.doneText", { name })}
				</p>
				{result.environmentError ? (
					<Alert
						tone="warning"
						title={t("publicSharing.view.run.environmentError")}
						data-id="run-import-env-error"
					>
						{result.environmentError.message}
					</Alert>
				) : null}
				<Link
					to={target}
					data-id="run-import-open"
					className={cn(
						buttonClassName({ variant: "primary", block: true }),
						"no-underline",
					)}
				>
					{t("publicSharing.view.run.openCollection")}
				</Link>
			</Card>
		</div>
	);
}
