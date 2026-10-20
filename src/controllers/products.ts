import type { Request, Response } from "express";
import products from "../products";

const categories = Array.from(new Set(products.map(product => product.category)));

export const productsController = (req: Request, res: Response) => {
    if (req.query.category) {
        const category = req.query.category.toString();
        const filteredProducts = products.filter(product => product.category === category);
        res.render("products.html", { products: filteredProducts, categories, currentCategory: category });
    } else {
        res.render("products.html", { products, categories, currentCategory: null });
    }
};