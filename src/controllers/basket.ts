import { Router } from "express";
import z from "zod";
import Basket from "../schemas/Basket";

const router = Router();

router.get("/", async (req, res) => {

    const basket = Basket.parse(await fetch(`${process.env.API_ADDRESS}/basket`, { headers: { "Authorization": `Bearer ${req.cookies.JWT_TOKEN}` } }).then(res => res.json()));

    res.render("basket.njk", { items: basket, total: basket.reduce((sum, item) => sum + item.product.price * item.quantity, 0) });
});

router.post("/", async (req, res) => {

    if (!res.locals.me) {
        return res.redirect("/login");
    }

    const { id, quantityMode, quantity } = z.object({
        id: z.string().transform(Number),
        quantityMode: z.enum(["relative", "absolute"]),
        quantity: z.string().transform(Number)
    }).parse(req.body);

    let newQuantity;
    if (quantityMode === "relative") {
        const r = await fetch(`${process.env.API_ADDRESS}/basket`, { headers: { "Authorization": `Bearer ${req.cookies.JWT_TOKEN}` } }).then(res => res.json());
        const basket = Basket.parse(r);
        const oldQuantity = basket.find(item => item.productId === id)?.quantity || 0;
        newQuantity = oldQuantity + quantity;
    } else {
        newQuantity = quantity;
    }

    const apiRes = await fetch(`${process.env.API_ADDRESS}/basket/${id}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${req.cookies.JWT_TOKEN}`, "Content-Type": "application/json" },
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
