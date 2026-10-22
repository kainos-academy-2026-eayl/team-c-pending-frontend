const orders = [
    {
        orderID: 1,
        price: 10.99,
        items: 3,
        customerID: 123,
    },
    {
        orderID: 2,
        price: 5.99,
        items: 1,
        customerID: 124,
    },
    {
        orderID: 3,
        price: 7.99,
        items: 2,
        customerID: 125,
    },
    {
        orderID: 4,
        price: 12.99,
        items: 4,
        customerID: 126,
    },
    {
        orderID: 5,
        price: 8.99,
        items: 2,
        customerID: 127,
    }
];
export const filterOrdersByPrice = (price: number) => {
    return orders.filter(order => order.price <= price);
};
export default orders;