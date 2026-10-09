import { type ReactNode, useMemo, useState } from "react";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../../components/ui/tabs";
import { useT } from "../../../i18n/i18n-context";
import type { SendResult } from "../workbench/workbench-types";
import { ResponseBody } from "./response-body";
import { ResponseCookiesTable } from "./response-cookies-table";
import { ResponseHeadersTable } from "./response-headers-table";
import { ResponseMeta } from "./response-meta";
import { ScriptResultsView } from "./script-results";
import { cookiesFromHeaders } from "./set-cookie-parser";

export interface ResponseResultProps {
	result: SendResult;
	routeBadge?: ReactNode;
	banner?: ReactNode;
}

type ResponseTab = "body" | "headers" | "cookies" | "tests";

function Count({ value }: { value: number }) {
	// The space keeps the tab's accessible name readable ("Headers 8").
	return (
		<>
			{" "}
			<span className="ml-1 font-normal text-muted text-xs">{value}</span>
		</>
	);
}

const PANE = "min-h-0 flex-1 overflow-auto";

/** A received response: tabs and meta on one row, then the chosen tab. */
export function ResponseResult({
	result,
	routeBadge,
	banner,
}: ResponseResultProps) {
	const t = useT();
	const { response, route, postScript } = result;
	const [tab, setTab] = useState<ResponseTab>("body");
	const cookies = useMemo(
		() => cookiesFromHeaders(response.headers, response.finalUrl),
		[response],
	);
	const tests = postScript?.tests ?? [];
	const choose = (value: string): void => {
		if (
			value === "body" ||
			value === "headers" ||
			value === "cookies" ||
			value === "tests"
		) {
			setTab(value);
		}
	};
	return (
		<Tabs
			value={tab}
			onValueChange={choose}
			className="flex min-h-0 flex-1 flex-col"
		>
			<div className="flex flex-wrap items-end justify-between gap-x-3 border-border-subtle border-b">
				<TabsList
					aria-label={t("apiClientTools.response.tabs.label")}
					className="border-b-0"
				>
					<TabsTrigger value="body" data-id="response-tab-body">
						{t("apiClientTools.response.tabs.body")}
					</TabsTrigger>
					<TabsTrigger value="headers" data-id="response-tab-headers">
						{t("apiClientTools.response.tabs.headers")}
						<Count value={response.headers.length} />
					</TabsTrigger>
					<TabsTrigger value="cookies" data-id="response-tab-cookies">
						{t("apiClientTools.response.tabs.cookies")}
						<Count value={cookies.length} />
					</TabsTrigger>
					<TabsTrigger value="tests" data-id="response-tab-tests">
						{t("apiClientTools.response.tabs.tests")}
						{tests.length > 0 ? <Count value={tests.length} /> : null}
					</TabsTrigger>
				</TabsList>
				<ResponseMeta
					response={response}
					route={route}
					routeBadge={routeBadge}
				/>
			</div>
			{banner ? <div className="px-4 pt-3">{banner}</div> : null}
			<TabsContent value="body" className="flex min-h-0 flex-1 flex-col">
				<ResponseBody response={response} />
			</TabsContent>
			<TabsContent value="headers" className={PANE}>
				<ResponseHeadersTable headers={response.headers} route={route} />
			</TabsContent>
			<TabsContent value="cookies" className={PANE}>
				<ResponseCookiesTable cookies={cookies} route={route} />
			</TabsContent>
			<TabsContent value="tests" className={PANE}>
				<ScriptResultsView results={postScript} />
			</TabsContent>
		</Tabs>
	);
}
