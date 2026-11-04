import z from "zod";
import productSchema from "./product.schema";

export default z.object({
    orderID: z.int(),
    customerID: z.int(),
    orderItems: z.array(z.object({
        productID: z.int(),
        quantity: z.int(),
        orderItemID: z.int(),
        itemStatus: z.string(),
        product: productSchema
    })),
    type: z.string(),
    status: z.string(),
    date: z.string(),
});
