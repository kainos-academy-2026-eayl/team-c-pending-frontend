import { Router } from "express";
import basket from "../mockData/basket";

const router = Router();

router.get("/", (_req, res) => {
    res.render("basket.njk", { items: basket, total: basket.reduce((sum, item) => sum + item.price * item.quantity, 0) });
});

export default router;
