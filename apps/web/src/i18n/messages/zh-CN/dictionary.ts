import type { Messages } from "../../message-types";
import { auth } from "./auth";
import { common } from "./common";
import { landing } from "./landing";
import { layout } from "./layout";

/** Simplified Chinese, loaded on demand (`load-messages.ts`). */
export const zhCN: Messages = { common, auth, layout, landing };
