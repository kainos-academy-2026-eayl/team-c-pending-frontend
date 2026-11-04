import type { Request, Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product from "../schemas/product.schema";

export const productsController = async (req: Request, res: Response) => {
    let productData;
    if (req.query.category) {
        const category = req.query.category.toString();
        productData = await cache(`products-category-${category}`, () => fetch(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`));
    } else {
        productData = await cache(`products-all`, () => fetch(`${process.env.API_ADDRESS}/products`));
    }
    const products = z.array(Product).parse(productData);
    const isHome = req.path === "/" && !req.query.category;
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
    res.render("products.njk", { products, bestSellers, bestSellersError, currentCategory: req.query.category, categories: await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`)) });
};

export const productController = async (req: Request, res: Response) => {
    const result = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!result.success) {
        return res.status(400).send("Invalid product ID");
    }
    const response = await fetch(`${process.env.API_ADDRESS}/products/${result.data}`);
    if (response.status === 404) {
        return res.status(404).render("product.njk", { product: null });
    }
    if (!response.ok) {
        throw new Error(`Failed to fetch product ${result.data}: HTTP ${response.status}`);
    }
    return res.render("product.njk", { product: Product.parse(await response.json()) });
};
