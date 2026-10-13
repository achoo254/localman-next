import { CodeBlock } from "../../../components/ui/code-block";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";
import { useTenantInfo } from "../../../lib/tenant-info";
import {
	TUNELO_INSTALL,
	tuneloHttpCommand,
	tuneloLoginCommand,
} from "./tunelo-commands";

/** Install, sign in, open a tunnel for `port`: the commands to copy. */
export function TuneloSteps({ port }: { port: number }) {
	const t = useT();
	const { tunnelDomain } = useTenantInfo();
	// A port is an identifier, not a quantity: no locale digit grouping (8.003).
	const portText = String(port);
	const steps = [
		{
			id: "install",
			title: t("apiClientTunelo.steps.install"),
			code: TUNELO_INSTALL,
		},
		{
			id: "login",
			title: t("apiClientTunelo.steps.login"),
			code: tuneloLoginCommand(tunnelDomain),
		},
		{
			id: "http",
			title: t("apiClientTunelo.steps.http", { port: portText }),
			code: tuneloHttpCommand(port),
		},
	];
	return (
		<div className="grid gap-2">
			<ol
				aria-label={t("apiClientTunelo.steps.label")}
				className="m-0 grid list-decimal gap-3 pl-5"
			>
				{steps.map((step) => (
					<li key={step.id}>
						<CodeBlock
							caption={step.title}
							code={step.code}
							wrap
							data-id={`tunelo-step-${step.id}`}
						/>
					</li>
				))}
			</ol>
			<p className="m-0 text-muted text-xs">
				{renderRich(t("apiClientTunelo.steps.tcpHint", { port: portText }))}
			</p>
		</div>
	);
}
