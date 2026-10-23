import { Router } from "express";
import z from "zod";
import Basket from "../schemas/Basket";

const router = Router();

router.get("/", async (_req, res) => {

    const basket = Basket.parse(await fetch(`${process.env.API_ADDRESS}/basket`).then(res => res.json()));

    res.render("basket.njk", { items: basket, total: basket.reduce((sum, item) => sum + item.product.price * item.quantity, 0) });
});

router.post("/", async (req, res) => {
    const { id, quantityMode, quantity } = z.object({
        id: z.number(),
        quantityMode: z.enum(["relative", "absolute"]),
        quantity: z.number()
    }).parse(req.body);


    let newQuantity;
    if (quantityMode === "relative") {
        const basket = Basket.parse(await fetch(`${process.env.API_ADDRESS}/basket`).then(res => res.json()));
        const oldQuantity = basket.find(item => item.productId === id)?.quantity || 0;
        newQuantity = oldQuantity + quantity;
    } else {
        newQuantity = quantity;
    }

    const apiRes = await fetch(`${process.env.API_ADDRESS}/basket/${id}`, {
        method: "POST",
        body: JSON.stringify({
            quantity: newQuantity,
        })
    });

    if (!apiRes.ok) {
        return res.status(apiRes.status).send(await apiRes.text());
    }
    res.redirect("/basket");

});

export default router;
