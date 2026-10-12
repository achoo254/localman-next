/** Docs: the Quick start page. `<link>` marks an in-docs link. */
export const docsQuickStart = {
	lead: "Create a mock REST API with realistic data for your frontend or tests to call, without building a backend.",
	createProject: {
		title: "1. Create a project",
		body: "On the Projects page, click Create project, give it a name and, if you like, an API prefix such as <code>/api/v1</code>. Each project has its own secret right in the mock URL; the API endpoint card on the project page shows the full URL. Every account has room for at least {projects} projects and {resources} resources in total.",
	},
	mockUrl: {
		title: "2. Mock API URL",
		caption: "Two URL forms for the same project",
		headerForm: "Form",
		headerUrl: "URL",
		headerWhen: "Use when",
		subdomain: "Subdomain",
		subdomainWhen: "Default.",
		path: "Path",
		pathWhen: "Your network or tool can't resolve the project's own subdomain.",
		secret:
			"The secret works like a password: anyone with the URL can read and write the mock data. The project owner can click Change mock URL to issue a new secret; the old URL returns 404 right away and the data stays. Paths are case-sensitive.",
		cors: "The mock returns JSON and allows every origin through CORS (no cookies sent), so a web page can call it directly from anywhere. Every response has an <code>X-Localman-Request-Id</code> header; include it when you ask for support.",
	},
	addResource: {
		title: "3. Add a resource and generate data",
		body: 'Click Add resource and give it a plural name, for example <code>customers</code>: the name is the first segment of the route. The schema is the list of fields of each record; a field can be a basic type or a Faker method that generates names, emails, dates… Hover the resource\'s generator bar and click the number of records you want (0 to {max}). Each record has a string <code>id</code>, numbered from <code>"1"</code>.',
	},
	endpoints: {
		title: "4. The five endpoints of a resource",
		caption: "Endpoints of the customers resource",
		headerResult: "Result",
		list: "200: an array of records. Filter, sort and paginate with the query.",
		get: "200: one record.",
		post: "201: the new record; its id is the next number. Schema fields the body leaves out are generated as if you clicked generate.",
		put: "200: fields in the body are merged into the record; fields you don't send stay. The id can't change.",
		delete:
			"200: the deleted record. Every child record of it in the resources nested below is deleted too.",
		body: "The body of POST, PUT and PATCH is a JSON object sent with the <code>Content-Type: application/json</code> header; without that header the body is treated as empty. Each endpoint can be turned off or have its response body reshaped, see <link>Custom responses</link>.",
	},
	nested: {
		title: "5. Nested routes",
		intro:
			"On the resource tree, click the dot on the left of <code>orders</code>, then the dot on the right of <code>customers</code> to nest it, so each order belongs to a customer. Records of <code>orders</code> get a <code>customerId</code> field (the parent's singular name plus <code>Id</code>), and the mock serves both nested and flat routes:",
		caption: "Routes of orders",
		parentCheck:
			"Nested routes check every parent record on the path: if customer 3 doesn't exist, or order 12 belongs to another customer, you get 404. POST on a nested route takes <code>customerId</code> from the path; POST on the flat route needs a <code>customerId</code> that points to an existing customer, otherwise you get 400.",
		depth:
			"The tree nests up to {depth} levels, for example <code>/customers/3/orders/12/items</code>. The flat route <code>/orders</code> points to the nested resource only when no other resource in the tree has the same name; if a root resource has that name, the flat route belongs to that root resource.",
	},
	query: {
		title: "6. Filter, sort, paginate",
		intro:
			"List routes (flat and nested) accept the parameters below, in any combination. They're applied in this order: filter, then sort, then page. Full examples are in <link>Code examples</link>.",
		rejected:
			"Parameter names that start with <code>$</code>, contain <code>.</code> or square brackets, and parameters sent twice are rejected with 400 <code>INVALID_QUERY</code>, so operator syntax like <code>?price[$gt]=10</code> doesn't work.",
	},
	status: {
		title: "7. Status codes and errors",
		body: 'Errors have a body like <code>{errorBody}</code>. Only a 404 for a well-formed secret returns exactly the JSON string <code>"Not found"</code>; a malformed secret gets the generic error form with <code>NOT_FOUND</code>. Rely on <code>code</code> in your handling, since <code>message</code> may be reworded.',
	},
} as const;
