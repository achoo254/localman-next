import type { Messages } from "../../message-types";
import { account } from "./account";
import { admin } from "./admin";
import { apiClient } from "./api-client";
import { apiClientOpen } from "./api-client-open";
import { apiClientRouting } from "./api-client-routing";
import { apiClientTools } from "./api-client-tools";
import { apiClientTunelo } from "./api-client-tunelo";
import { auth } from "./auth";
import { collaborators } from "./collaborators";
import { common } from "./common";
import { docs } from "./docs";
import { feedback } from "./feedback";
import { invite } from "./invite";
import { landing } from "./landing";
import { layout } from "./layout";
import { mcp } from "./mcp";
import { mockCallbacks } from "./mock-callbacks";
import { notifications } from "./notifications";
import { primitives } from "./primitives";
import { projectDetail } from "./project-detail";
import { projects } from "./projects";
import { resourceChaos } from "./resource-chaos";
import { resourceExport } from "./resource-export";
import { resourceImport } from "./resource-import";
import { resourceRules } from "./resource-rules";
import { resourceTree } from "./resource-tree";
import { resources } from "./resources";
import { sharing } from "./sharing";
import { subscription } from "./subscription";
import { trafficLog } from "./traffic-log";
import { ui } from "./ui";
import { upstream } from "./upstream";
import { webhookInbox } from "./webhook-inbox";
import { workspaces } from "./workspaces";

/** Vietnamese, loaded on demand (`load-messages.ts`). */
export const vi: Messages = {
	common,
	auth,
	layout,
	landing,
	ui,
	projects,
	projectDetail,
	resources,
	resourceTree,
	resourceImport,
	resourceExport,
	resourceChaos,
	resourceRules,
	account,
	collaborators,
	invite,
	mcp,
	notifications,
	subscription,
	docs,
	feedback,
	admin,
	primitives,
	apiClient,
	apiClientOpen,
	apiClientTools,
	apiClientRouting,
	apiClientTunelo,
	upstream,
	trafficLog,
	webhookInbox,
	mockCallbacks,
	workspaces,
	sharing,
};
