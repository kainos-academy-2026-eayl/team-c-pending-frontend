import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
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
    price: z.coerce.number().finite().nonnegative(),
    description: z.string().trim().min(1),
    category: z.string().trim().min(1),
    quantity: z.coerce.number().int().nonnegative(),
    image: z.string().transform((image) => image.trim() || null),
});

const RouteID = z.string().regex(/^[1-9]\d*$/);
const DeleteParams = z.object({
    section: z.literal("customers"),
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

router.get("/:section/:id/delete", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const params = DeleteParams.safeParse(req.params);
    if (!params.success) return res.status(400).send("Invalid deletion request");

    return res.render("adminDelete.njk", {
        ...params.data,
        filterQuery: new URLSearchParams(filters(req)).toString(),
    });
});

router.post("/:section/:id/delete", async (req: Request, res: Response) => {
    const token = requireAdmin(req, res);
    if (!token) return;
    const params = DeleteParams.safeParse(req.params);
    if (!params.success) return res.status(400).send("Invalid deletion request");
    const { section, id } = params.data;
    if (req.body.confirm !== "delete") {
        return redirectToSection(req, res, section, "error", "Deletion must be confirmed");
    }

    const response = await fetch(`${process.env.API_ADDRESS}/${section}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const error = z.object({ error: z.string() }).parse(await response.json());
        return redirectToSection(req, res, section, "error", error.error);
    }
    return redirectToSection(req, res, section, "success",
        "Customer and their orders and basket deleted");
});

router.get(["/customers", "/products"], async (req: Request, res: Response) => {
    const token = requireAdmin(req, res);
    if (!token) return;

    const section = req.path === "/customers" ? "customers" : "products";
    const apiPath = section === "products" ? "products/admin" : "customers";
    const response = await fetch(`${process.env.API_ADDRESS}/${apiPath}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        return res.status(response.status).send(`Unable to load ${section} (${response.status})`);
    }

    const { search, category } = filters(req);
    const query = search.toLowerCase();
    const customers = section === "customers"
        ? z.array(Customer).parse(await response.json()).filter((customer) =>
            `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(query)
            || customer.email.toLowerCase().includes(query),
        )
        : [];
    const allProducts = section === "products"
        ? z.array(Product.extend({ hide: z.boolean() })).parse(await response.json())
        : [];
    const categories = [...new Set(allProducts.map((product) => product.category))]
        .sort((a, b) => a.localeCompare(b));
    const products = allProducts.filter((product) =>
        product.name.toLowerCase().includes(query)
        && (!category || product.category === category),
    );
    const filterQuery = new URLSearchParams({ search, category }).toString();
    const error = typeof req.query.error === "string" ? req.query.error : undefined;
    const success = typeof req.query.success === "string" ? req.query.success : undefined;
    return res.render("adminPortal.njk", {
        section, customers, products, categories, search, category, filterQuery, error, success,
    });
});

router.post("/customers/:customerID", async (req: Request, res: Response) => {
    const token = requireAdmin(req, res);
    if (!token) return;

    const customerID = RouteID.safeParse(req.params.customerID);
    if (!customerID.success) {
        return redirectToSection(req, res, "customers", "error", "Invalid customer id");
    }

    const changes = CustomerChanges.safeParse(req.body);
    if (!changes.success) {
        return redirectToSection(req, res, "customers", "error", changes.error.issues[0]!.message);
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
        return redirectToSection(req, res, "customers", "error", `Could not update customer (${response.status})`);
    }

    return redirectToSection(req, res, "customers", "success", "Customer details updated");
});

router.post("/products/:productID/visibility", async (req: Request, res: Response) => {
    const token = requireAdmin(req, res);
    if (!token) return;

    const productID = RouteID.safeParse(req.params.productID);
    const visibility = z.object({ hide: z.enum(["true", "false"]) }).safeParse(req.body);
    if (!productID.success || !visibility.success) {
        return redirectToSection(req, res, "products", "error", "Invalid product visibility request");
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
        return redirectToSection(req, res, "products", "error", `Could not update product visibility (${response.status})`);
    }

    return redirectToSection(req, res, "products", "success", hide ? "Product hidden and removed from all customers' baskets" : "Product shown");
});

router.post("/products/:productID", async (req: Request, res: Response) => {
    const token = requireAdmin(req, res);
    if (!token) return;

    const productID = RouteID.safeParse(req.params.productID);
    if (!productID.success) {
        return redirectToSection(req, res, "products", "error", "Invalid product id");
    }

    const changes = ProductChanges.safeParse(req.body);
    if (!changes.success) {
        return redirectToSection(req, res, "products", "error", changes.error.issues[0]!.message);
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
        return redirectToSection(req, res, "products", "error", `Could not update product (${response.status})`);
    }

    return redirectToSection(req, res, "products", "success", "Product details updated");
});

export default router;
