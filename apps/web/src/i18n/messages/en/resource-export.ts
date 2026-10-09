/** "Export types" menu of a resource (node and resource form). */
export const resourceExport = {
	trigger: "Export types",
	triggerLabel: "Export types of {name}",
	copyTs: "Copy TypeScript",
	copyZod: "Copy Zod schema",
	download: "Download <code>{file}</code>",
	savedOnly:
		"Exports the saved schema. Update the resource to include your changes.",
	copiedTs: "Copied the TypeScript types of {name}.",
	copiedZod: "Copied the Zod schema of {name}.",
	downloaded: "Downloaded {file}.",
	copyBlocked: "Your browser blocked copying. Use Download instead.",
} as const;
