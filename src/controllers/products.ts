import type { Request, Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product from "../schemas/product.schema";

export const productsController = async (req: Request, res: Response) => {
    let productData: globalThis.Response;
    if (req.query.category) {
        const category = req.query.category.toString();
        productData = await fetch(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`);
    } else {
        productData = await fetch(`${process.env.API_ADDRESS}/products`);
    }
    const products = z.array(Product).parse(await productData.json()).sort((a, b) => a.name.localeCompare(b.name));
    res.render("products.njk", { products, currentCategory: req.query.category, categories: await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`)) });
};
