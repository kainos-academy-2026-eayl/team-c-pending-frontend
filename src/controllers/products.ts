import { Router, type Request, type Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product, { ProductWithReviews } from "../schemas/product.schema";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    let productData: globalThis.Response;
    if (req.query.category) {
        const category = req.query.category.toString();
        productData = await fetch(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`);
    } else {
        productData = await fetch(`${process.env.API_ADDRESS}/products`);
    }
    const products = z.array(Product).parse(await productData.json()).sort((a, b) => a.name.localeCompare(b.name));
    res.render("products.njk", { nextBackURL: req.originalUrl, products, currentCategory: req.query.category, categories: await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`)) });
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const productData = await fetch(`${process.env.API_ADDRESS}/products/${encodeURIComponent(id)}`);
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
    res.render("addReviewMessage.njk", { product, rating: req.query.rating });
});

router.post("/:id/add_review", async (req: Request, res: Response) => {
        if (!res.locals.me) {
        return res.redirect("/login");
    }
    const input = z.object({
        rating: z.string().transform(Number),
        message: z.string().optional()
    }).parse(req.body);
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
