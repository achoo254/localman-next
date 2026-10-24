/** Public docs of a mock project: publishing them and the public page. */
export const projectDocs = {
	publish: {
		button: "Docs",
		title: "Public docs",
		intro:
			"Docs of this project's resources, fields and endpoints, always as they are now. Anyone with the link reads them without signing in.",
		toggle: "Publish docs",
		toggleHint:
			"The mock URL is not in them: paths start at {baseUrl}, which you share yourself. Turning this off makes the link stop working.",
		link: "Link to the docs",
	},
	page: {
		pageTitle: "API docs",
		badge: "Generated from a mock",
		intro:
			"These docs follow the mock's resources as they are now. Paths start at the mock's base URL, which its owner shares with you.",
		endpoints: "Endpoints",
		fields: "Fields",
		field: "Field",
		type: "Type",
		detail: "Detail",
		example: "Example record",
		empty: "This project has no resources yet.",
		notFoundTitle: "These docs are not published",
		notFoundText: "The link is wrong, or the project took its docs down.",
	},
} as const;
