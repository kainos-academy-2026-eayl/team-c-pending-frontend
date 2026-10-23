import z from "zod";
import Product from "./Product";

export default z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
    product: Product,
}));
