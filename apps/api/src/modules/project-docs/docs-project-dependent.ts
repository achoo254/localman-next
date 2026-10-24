import { registerProjectDependent } from "../projects/project-dependents.js";
import { DocsLinkModel } from "./docs-link-model.js";

// Registered at module load (docs-operations imports this module): a
// deleted project's docs link goes with it; a clone is not published.
registerProjectDependent({
	kind: "docsLinks",
	count: (projectId) => DocsLinkModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await DocsLinkModel.deleteMany({ projectId });
	},
});
