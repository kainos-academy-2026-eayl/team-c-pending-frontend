import { Router, type Request, type Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product, { ProductWithReviews } from "../schemas/product.schema";

const router = Router();

export const productsController = async (req: Request, res: Response) => {
    const parsedInput = z.object({
        q: z.string().trim().optional(),
        category: z.string().optional()
    }).safeParse(req.query);
    if (!parsedInput.success) {
        return res.status(400).send("Invalid search or category");
    }
    const searchQuery = parsedInput.data.q ?? "";
    const category = parsedInput.data.category;
    let productErrorStatus: number | undefined;
    const loadProducts = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) productErrorStatus = response.status;
        return response;
    };
    let productData;
    try {
        if (category) {
            productData = await cache(`products-category-${category}`, () => loadProducts(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`));
        } else {
            productData = await cache(`products-all`, () => loadProducts(`${process.env.API_ADDRESS}/products`));
        }
    } catch (error) {
        if (!productErrorStatus) throw error;
    }
    if (productErrorStatus) {
        return res.status(productErrorStatus).send("Unable to load products");
    }
    const productsParsed = z.array(Product).safeParse(productData);
    const products = productsParsed.success ? productsParsed.data : [];
    const searchTerm = searchQuery.toLowerCase();
    const matchingProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm) || product.description.toLowerCase().includes(searchTerm));
    const isHome = req.path === "/" && !category && !searchQuery;
    let bestSellers: z.infer<typeof Product>[] = [];
    let bestSellersError = false;
    if (isHome) {
        try {
            bestSellers = z.array(Product).max(12).parse(
                await cache("products-home-carousel", async () => {
                    const ranked = z.array(Product).max(12).parse(
                        await cache("products-best-sellers", () => fetch(`${process.env.API_ADDRESS}/products/best-sellers`)),
                    );
                    const selected = new Map(ranked.map((product) => [product.id, product]));
                    const remaining = [...new Map(
                        products.filter((product) => !selected.has(product.id))
                            .map((product) => [product.id, product]),
                    ).values()];
                    for (let index = remaining.length - 1; index > 0; index--) {
                        const randomIndex = Math.floor(Math.random() * (index + 1));
                        const current = remaining[index]!;
                        remaining[index] = remaining[randomIndex]!;
                        remaining[randomIndex] = current;
                    }
                    return globalThis.Response.json([...selected.values(), ...remaining.slice(0, 12 - selected.size)]);
                }),
            );
        } catch (error) {
            console.error("Failed to load best-selling products", error);
            bestSellersError = true;
        }
    }
    const categoriesData = await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`));
    const categories = Array.isArray(categoriesData) ? categoriesData : [];
    res.render("products.njk", { backendUrl: process.env.API_ADDRESS, nextBackURL: req.originalUrl, products: matchingProducts.sort((a, b) => a.name.localeCompare(b.name)), bestSellers, bestSellersError, searchQuery, currentCategory: category, categories });
};

export const productController = async (req: Request, res: Response) => {
    const result = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!result.success) {
        return res.status(400).send("Invalid product ID");
    }
    try {
        const response = await fetch(`${process.env.API_ADDRESS}/products/${result.data}`);
        if (response.status === 404) {
            return res.status(404).render("product.njk", { product: null });
        }
        if (!response.ok) {
            return res.status(500).render("product.njk", { product: null });
        }
        const product = ProductWithReviews.parse(await response.json());
        const stars = product.reviews.length
            ? Math.round(product.reviews.reduce((acc, review) => acc + review.rating, 0) / product.reviews.length)
            : 0;
        return res.render("product.njk", { backendUrl: process.env.API_ADDRESS, product, stars });
    } catch (error) {
        console.error("Failed to load product", error);
        return res.status(500).render("product.njk", { product: null });
    }
};

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
