import type { Request, Response } from "express";
import cache from "../cache";
import { z } from "zod";
import Product from "../schemas/Product";

export const productsController = async (req: Request, res: Response) => {
    let productData;
    if (req.query.category) {
        const category = req.query.category.toString();
        productData = await cache(`products-category-${category}`, () => fetch(`${process.env.API_ADDRESS}/products/category?category=${encodeURIComponent(category)}`));
    } else {
        productData = await cache(`products-all`, () => fetch(`${process.env.API_ADDRESS}/products`));
    }
    const products = z.array(Product).parse(productData);
    res.render("products.njk", { products, currentCategory: req.query.category, categories: await cache(`categories-all`, () => fetch(`${process.env.API_ADDRESS}/products/categories`)) });
};
