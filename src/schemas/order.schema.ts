import z from "zod";

export default z.object({
    orderID: z.int(),
    customerID: z.int(),
    orderItems: z.array(z.object({
        productID: z.int(),
        quantity: z.int(),
        orderItemID: z.int(),
        itemStatus: z.string(),
    })),
    type: z.string(),
    status: z.string(),
    date: z.date(),
});
