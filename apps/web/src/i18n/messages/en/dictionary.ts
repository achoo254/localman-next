import { account } from "./account";
import { admin } from "./admin";
import { auth } from "./auth";
import { collaborators } from "./collaborators";
import { common } from "./common";
import { docs } from "./docs";
import { feedback } from "./feedback";
import { invite } from "./invite";
import { landing } from "./landing";
import { layout } from "./layout";
import { mcp } from "./mcp";
import { notifications } from "./notifications";
import { primitives } from "./primitives";
import { projectDetail } from "./project-detail";
import { projects } from "./projects";
import { resourceTree } from "./resource-tree";
import { resources } from "./resources";
import { subscription } from "./subscription";
import { ui } from "./ui";

/**
 * English dictionary: the source of every key and of the `Messages` type
 * that the other languages must fill. One namespace per area of the app.
 */
export const en = {
	common,
	auth,
	layout,
	landing,
	ui,
	projects,
	projectDetail,
	resources,
	resourceTree,
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
} as const;
