import mongoose from "mongoose";
import { registerProjectDependent } from "../projects/project-dependents.js";
import { SyncLinkModel, deleteSyncLink } from "./sync-link-model.js";

// Registered at module load (sync-operations imports this module): a
// deleted project's collections stop syncing and stay as they are. A
// clone gets no links (no `copy`).
registerProjectDependent({
	kind: "syncedCollections",
	count: (projectId) => SyncLinkModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		const links = await SyncLinkModel.find({ projectId }, { _id: 1 }).lean<
			{ _id: mongoose.Types.ObjectId }[]
		>();
		for (const link of links) {
			await mongoose.connection.transaction((session) =>
				deleteSyncLink(link._id, session),
			);
		}
	},
});
