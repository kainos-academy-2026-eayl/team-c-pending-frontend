import z from "zod";

const ProductFields = z.object({
	name: z.string(),
	productID: z.number().optional(),
	id: z.number().optional(),
	price: z.number(),
	description: z.string(),
	category: z.string(),
	quantity: z.int(),
	image: z.string().nullable(),
});

const normalizeProduct = ({
	productID,
	id,
	...product
}: z.infer<typeof ProductFields>) => ({
	...product,
	productID: productID ?? id!,
	id: productID ?? id!,
});

const Product = ProductFields.refine(
	(data) => data.productID !== undefined || data.id !== undefined,
	"Must have either productID or id",
).transform(normalizeProduct);

export const ProductWithReviews = ProductFields.extend({
	reviews: z
		.array(
			z.object({
				rating: z.number(),
				comment: z.string().optional(),
				customer: z.object({
					customerID: z.number(),
					firstName: z.string(),
					lastName: z.string(),
				}),
			}),
		)
		.default([]),
})
	.refine(
		(data) => data.productID !== undefined || data.id !== undefined,
		"Must have either productID or id",
	)
	.transform(({ reviews, ...product }) => ({
		...normalizeProduct(product),
		reviews,
	}));

export default Product;
