import z from "zod";
import Product from "./product.schema";

export default z.array(z.object({
    productId: z.number(),
    quantity: z.number(),
    product: Product,
}));
