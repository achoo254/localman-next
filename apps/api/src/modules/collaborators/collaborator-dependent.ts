import { registerProjectDependent } from "../projects/project-dependents.js";
import { CollaboratorModel } from "./collaborator-model.js";
import { MagicLinkModel } from "./magic-link-model.js";

// Registered at module load; collaborator-operations imports this module,
// so any process serving the registry cascades members and the magic link
// on project deletion. Neither has `copy`: a clone gets no members.
// Writes to both run under the project lock and check the tombstone, so
// nothing is added after this cleanup.
registerProjectDependent({
	kind: "collaborators",
	count: (projectId) => CollaboratorModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await CollaboratorModel.deleteMany({ projectId });
	},
});

registerProjectDependent({
	kind: "magicLinks",
	count: (projectId) => MagicLinkModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await MagicLinkModel.deleteMany({ projectId });
	},
});
