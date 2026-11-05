import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import Order from "../schemas/order.schema";
import Product from "../schemas/product.schema";

const router = Router();

const Customer = z.object({
	customerID: z.number(),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string(),
	role: z.string(),
});

const CustomerChanges = z.object({
	firstName: z.string().trim().min(1),
	lastName: z.string().trim().min(1),
	email: z.email(),
});

const ProductChanges = z.object({
	name: z.string().trim().min(1),
	price: z
		.string()
		.trim()
		.min(1, "Price is required")
		.transform(Number)
		.pipe(z.number().finite().nonnegative()),
	description: z.string().trim().min(1),
	category: z.string().trim().min(1),
	quantity: z
		.string()
		.trim()
		.min(1, "Quantity is required")
		.transform(Number)
		.pipe(z.number().int().nonnegative()),
	image: z.string().transform((image) => image.trim() || null),
});

const AdminOrder = Order.extend({
	customer: z.object({
		firstName: z.string(),
		lastName: z.string(),
	}),
	orderItems: z.array(
		Order.shape.orderItems.element.extend({
			unitPrice: z.number().finite().nonnegative(),
			product: z.object({ name: z.string() }),
		}),
	),
	date: z.iso.datetime(),
});

const OrderFilters = z.object({
	search: z.string().trim().default(""),
	status: z.string().default(""),
	sort: z.enum(["newest", "oldest"]).default("newest"),
});

const RouteID = z.string().regex(/^[1-9]\d*$/);
const DeleteParams = z.object({
	id: RouteID,
});

function filters(req: Request) {
	return {
		search: typeof req.query.search === "string" ? req.query.search.trim() : "",
		category: typeof req.query.category === "string" ? req.query.category : "",
	};
}

function redirectToSection(
	req: Request,
	res: Response,
	section: "customers" | "products",
	messageType: "error" | "success",
	message: string,
) {
	const { search, category } = filters(req);
	const query = new URLSearchParams({ search, [messageType]: message });
	if (section === "products" && category) query.set("category", category);
	return res.redirect(`/admin/${section}?${query}`);
}

function requireAdmin(req: Request, res: Response): string | null {
	if (!res.locals.me) {
		res.redirect("/login");
		return null;
	}

	if (res.locals.me.role !== "admin") {
		res.redirect("/");
		return null;
	}

	return req.cookies.JWT_TOKEN as string;
}

router.get("/", (req: Request, res: Response) => {
	if (!requireAdmin(req, res)) return;
	return res.redirect("/admin/customers");
});

router.get("/products/new", (req: Request, res: Response) => {
	if (!requireAdmin(req, res)) return;
	return res.render("adminPortal.njk", {
		section: "add-products",
		values: {},
		success:
			typeof req.query.success === "string" ? req.query.success : undefined,
	});
});

router.post("/products/new", async (req: Request, res: Response) => {
	const token = requireAdmin(req, res);
	if (!token) return;
	const values = z
		.object({
			name: z.string().default(""),
			price: z.string().default(""),
			category: z.string().default(""),
			description: z.string().default(""),
			quantity: z.string().default(""),
			image: z.string().default(""),
		})
		.parse(req.body);
	const result = ProductChanges.extend({
		price: z
			.string()
			.trim()
			.min(1, "Price is required")
			.transform(Number)
			.pipe(z.number().finite().nonnegative()),
		quantity: z
			.string()
			.trim()
			.min(1, "Quantity is required")
			.transform(Number)
			.pipe(z.number().int().nonnegative()),
	}).safeParse(values);
	if (!result.success) {
		return res.status(400).render("adminPortal.njk", {
			section: "add-products",
			values,
			error: result.error.issues[0]!.message,
		});
	}

	const response = await fetch(`${process.env.API_ADDRESS}/products`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(result.data),
	});
	if (!response.ok) {
		return res.status(response.status).render("adminPortal.njk", {
			section: "add-products",
			values,
			error: `Could not add product (${response.status})`,
		});
	}
	return res.redirect(
		"/admin/products/new?success=Product+added+and+available+for+browsing",
	);
});

router.get("/orders", async (req: Request, res: Response) => {
	const token = requireAdmin(req, res);
	if (!token) return;
	const query = OrderFilters.safeParse(req.query);
	if (!query.success) {
		return res.status(400).send("Invalid order filters");
	}
	const { search, status, sort } = query.data;
	const response = await fetch(`${process.env.API_ADDRESS}/orders/admin`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		return res
			.status(response.status)
			.send(`Unable to load orders (${response.status})`);
	}
	const allOrders = z.array(AdminOrder).parse(await response.json());
	const statuses = [...new Set(allOrders.map((order) => order.status))].sort(
		(a, b) => a.localeCompare(b),
	);
	const nameQuery = search.toLowerCase();
	const orders = allOrders
		.filter(
			(order) =>
				`${order.customer.firstName} ${order.customer.lastName}`
					.toLowerCase()
					.includes(nameQuery) &&
				(!status || order.status === status),
		)
		.sort((a, b) => {
			const difference =
				Date.parse(a.date) - Date.parse(b.date) || a.orderID - b.orderID;
			return sort === "oldest" ? difference : -difference;
		})
		.map((order) => ({
			...order,
			formattedDate: new Date(order.date).toLocaleString("en-GB", {
				timeZone: "UTC",
			}),
			total: order.orderItems.reduce(
				(sum, item) => sum + item.unitPrice * item.quantity,
				0,
			),
		}));
	return res.render("adminPortal.njk", {
		section: "orders",
		orders,
		statuses,
		search,
		status,
		sort,
	});
});

router.get(
	["/customer/:id/delete", "/customers/:id/delete"],
	(req: Request, res: Response) => {
		if (!requireAdmin(req, res)) return;
		const params = DeleteParams.safeParse(req.params);
		if (!params.success)
			return res.status(400).send("Invalid deletion request");

		return res.render("adminDelete.njk", {
			...params.data,
			filterQuery: new URLSearchParams(filters(req)).toString(),
		});
	},
);

router.post(
	["/customer/:id/delete", "/customers/:id/delete"],
	async (req: Request, res: Response) => {
		const token = requireAdmin(req, res);
		if (!token) return;
		const params = DeleteParams.safeParse(req.params);
		if (!params.success)
			return res.status(400).send("Invalid deletion request");
		const { id } = params.data;
		if (req.body.confirm !== "delete") {
			return redirectToSection(
				req,
				res,
				"customers",
				"error",
				"Deletion must be confirmed",
			);
		}

		const response = await fetch(`${process.env.API_ADDRESS}/customers/${id}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!response.ok) {
			const error = z
				.object({ error: z.string() })
				.parse(await response.json());
			return redirectToSection(req, res, "customers", "error", error.error);
		}
		return redirectToSection(
			req,
			res,
			"customers",
			"success",
			"Customer and their orders and basket deleted",
		);
	},
);

router.get(["/customers", "/products"], async (req: Request, res: Response) => {
	const token = requireAdmin(req, res);
	if (!token) return;

	const section =
		req.path.replace(/\/$/, "").toLowerCase() === "/customers"
			? "customers"
			: "products";
	const apiPath = section === "products" ? "products/admin" : "customers";
	const response = await fetch(`${process.env.API_ADDRESS}/${apiPath}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		return res
			.status(response.status)
			.send(`Unable to load ${section} (${response.status})`);
	}

	const { search, category } = filters(req);
	const query = search.toLowerCase();
	const customers =
		section === "customers"
			? z
					.array(Customer)
					.parse(await response.json())
					.filter(
						(customer) =>
							`${customer.firstName} ${customer.lastName}`
								.toLowerCase()
								.includes(query) ||
							customer.email.toLowerCase().includes(query),
					)
					.sort((a, b) => a.customerID - b.customerID)
			: [];
	const allProducts =
		section === "products"
			? z
					.array(Product.and(z.object({ hide: z.boolean() })))
					.parse(await response.json())
			: [];
	const categories = [
		...new Set(allProducts.map((product) => product.category)),
	].sort((a, b) => a.localeCompare(b));
	const products = allProducts
		.filter(
			(product) =>
				product.name.toLowerCase().includes(query) &&
				(!category || product.category === category),
		)
		.sort((a, b) => a.productID - b.productID);
	const filterQuery = new URLSearchParams({ search, category }).toString();
	const error =
		typeof req.query.error === "string" ? req.query.error : undefined;
	const success =
		typeof req.query.success === "string" ? req.query.success : undefined;
	return res.render("adminPortal.njk", {
		section,
		customers,
		products,
		categories,
		search,
		category,
		filterQuery,
		error,
		success,
	});
});

router.post("/customers/:customerID", async (req: Request, res: Response) => {
	const token = requireAdmin(req, res);
	if (!token) return;

	const customerID = RouteID.safeParse(req.params.customerID);
	if (!customerID.success) {
		return redirectToSection(
			req,
			res,
			"customers",
			"error",
			"Invalid customer id",
		);
	}

	const changes = CustomerChanges.safeParse(req.body);
	if (!changes.success) {
		return redirectToSection(
			req,
			res,
			"customers",
			"error",
			changes.error.issues[0]!.message,
		);
	}

	const response = await fetch(
		`${process.env.API_ADDRESS}/customers/${customerID.data}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(changes.data),
		},
	);

	if (!response.ok) {
		return redirectToSection(
			req,
			res,
			"customers",
			"error",
			`Could not update customer (${response.status})`,
		);
	}

	return redirectToSection(
		req,
		res,
		"customers",
		"success",
		"Customer details updated",
	);
});

router.post(
	"/products/:productID/visibility",
	async (req: Request, res: Response) => {
		const token = requireAdmin(req, res);
		if (!token) return;

		const productID = RouteID.safeParse(req.params.productID);
		const visibility = z
			.object({ hide: z.enum(["true", "false"]) })
			.safeParse(req.body);
		if (!productID.success || !visibility.success) {
			return redirectToSection(
				req,
				res,
				"products",
				"error",
				"Invalid product visibility request",
			);
		}

		const hide = visibility.data.hide === "true";
		const response = await fetch(
			`${process.env.API_ADDRESS}/products/${productID.data}`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ hide }),
			},
		);
		if (!response.ok) {
			return redirectToSection(
				req,
				res,
				"products",
				"error",
				`Could not update product visibility (${response.status})`,
			);
		}

		return redirectToSection(
			req,
			res,
			"products",
			"success",
			hide
				? "Product hidden and removed from all customers' baskets"
				: "Product shown",
		);
	},
);

router.post("/products/:productID", async (req: Request, res: Response) => {
	const token = requireAdmin(req, res);
	if (!token) return;

	const productID = RouteID.safeParse(req.params.productID);
	if (!productID.success) {
		return redirectToSection(
			req,
			res,
			"products",
			"error",
			"Invalid product id",
		);
	}

	const changes = ProductChanges.safeParse(req.body);
	if (!changes.success) {
		return redirectToSection(
			req,
			res,
			"products",
			"error",
			changes.error.issues[0]!.message,
		);
	}

	const response = await fetch(
		`${process.env.API_ADDRESS}/products/${productID.data}`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(changes.data),
		},
	);

	if (!response.ok) {
		return redirectToSection(
			req,
			res,
			"products",
			"error",
			`Could not update product (${response.status})`,
		);
	}

	return redirectToSection(
		req,
		res,
		"products",
		"success",
		"Product details updated",
	);
});

export default router;
