import { Router, type Request, type Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product, { ProductWithReviews } from "../schemas/product.schema";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    const parsedInput = z.object({
        q: z.string().trim().optional(),
        category: z.string().optional()
    }).safeParse(req.query);
    if (!parsedInput.success) {
        return res.status(400).send("Invalid search or category");
    }
    const searchQuery = parsedInput.data.q ?? "";
    const category = parsedInput.data.category;
    let productData: globalThis.Response;
    if (category) {
        productData = await fetch(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`);
    } else {
        productData = await fetch(`${process.env.API_ADDRESS}/products`);
    }
    if (!productData.ok) {
        return res.status(productData.status).send("Unable to load products");
    }
    const searchTerm = searchQuery.toLowerCase();
    const products = z.array(Product).parse(await productData.json())
        .filter(product => product.name.toLowerCase().includes(searchTerm) || product.description.toLowerCase().includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));
    res.render("products.njk", { nextBackURL: req.originalUrl, products, searchQuery, currentCategory: category, categories: await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`)) });
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const productData = await fetch(`${process.env.API_ADDRESS}/products/${encodeURIComponent(id)}`);
    if (!productData.ok) {
        return res.status(productData.status).send(productData.status === 404 ? "Product not found" : "Unable to load product");
    }
    const product = ProductWithReviews.parse(await productData.json());
    const stars = Math.round(product.reviews.reduce((acc, review) => acc + review.rating, 0)/product.reviews.length);
    res.render("product.njk", { product, stars });
});

router.get("/:id/add_review", async (req: Request, res: Response) => {
    if (!res.locals.me) {
        return res.redirect("/login");
    }
    const id = req.params.id as string;
    const productData = await fetch(`${process.env.API_ADDRESS}/products/${encodeURIComponent(id)}`);
    const product = Product.parse(await productData.json());
    res.render("review.njk", { product, rating: req.query.rating, stars: Array(5).fill(0).map((_, i) => i < Number(req.query.rating) ? '/star_full.svg' : '/star_empty.svg') });
});

router.get("/:id/add_review_message", async (req: Request, res: Response) => {
        if (!res.locals.me) {
        return res.redirect("/login");
    }
    const id = req.params.id as string;
    const productData = await fetch(`${process.env.API_ADDRESS}/products/${encodeURIComponent(id)}`);
    const product = Product.parse(await productData.json());
    res.render("addReviewMessage.njk", { product, rating: req.query.rating, error: req.query.error });
});

router.post("/:id/add_review", async (req: Request, res: Response) => {
        if (!res.locals.me) {
        return res.redirect("/login");
    }
    const parsedInput = z.object({
        rating: z.string().regex(/^[1-5]$/, "Choose a rating from 1 to 5").transform(Number),
        message: z.string().optional()
    }).safeParse(req.body);
    if (!parsedInput.success) {
        return res.status(400).json({
            errors: parsedInput.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message }))
        });
    }
    const input = parsedInput.data;
    const id = req.params.id as string;
    const response = await fetch(`${process.env.API_ADDRESS}/products/${encodeURIComponent(id)}/reviews`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${req.cookies.JWT_TOKEN}`
        },
        body: JSON.stringify(input)
    });
    if (!response.ok) {
        if (response.status === 400) {
            return res.redirect(`/products/${id}/add_review_message?error=${encodeURIComponent("Invalid review")}&rating=${req.body.rating}`);
        }
        return res.status(response.status).send(await response.text());
    }
    res.redirect(`/products/${id}`);
});

export default router;
