import z from "zod";
import Product from "./product.schema";

export default z.array(z.object({
    productID: z.number(),
    quantity: z.number(),
    product: Product,
}));
