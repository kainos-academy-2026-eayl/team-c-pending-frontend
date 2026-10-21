import type { Request, Response } from "express";
import products, { filterProductsByCategory, categories } from "../products";



export const productsController = (req: Request, res: Response) => {
    if (req.query.category) {
        const category = req.query.category.toString();
        const filteredProducts = filterProductsByCategory(category);
        res.render("products.njk", { products: filteredProducts, categories, currentCategory: category });
    } else {
        res.render("products.njk", { products, categories, currentCategory: null });
    }
};
