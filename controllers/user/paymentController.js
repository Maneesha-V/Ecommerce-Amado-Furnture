const User = require("../../models/userModel")
const Cart = require("../../models/cartModel")
const Order = require("../../models/orderModel")
const Product = require("../../models/productModel")
const Wallet = require("../../models/walletModel")
const Razorpay = require("razorpay");
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

async function handleCODPayment(cart, userId, selectedAddressId, totalAmount, couponDiscount) {
    try {
        const orderItems = await Promise.all(cart.items.map(async (item) => {
            const product = await Product.findById(item.product._id);
            if (!product) {
                return res.status(404).send(`Product with ID ${item.product._id} not found.`);
            }

            const prodImage = product.prodImages.length > 0 ? product.prodImages[0] : '';
            const offerDiscount = product.activeOffer
                ? (product.price - product.offerDiscountedPrice) * item.quantity : 0;
            return {
                product: product._id,
                prodName: product.name,
                prodImage: prodImage, 
                quantity: item.quantity,
                price: product.price,
                itemStatus: 'Pending',
                offerDiscount
            };
        }));
        const orderNumber = await generateOrderNumber();

        const order = new Order({
            orderNumber: orderNumber,
            user: userId,
            items: orderItems,
            totalAmount: totalAmount,
            address: selectedAddressId,
            paymentMethod: 'COD',
            status: 'Pending',
            couponDiscount: couponDiscount
        });

        await order.save();
        await Cart.findOneAndDelete({ user: userId });

        const address = await getOrderedAddress(userId, selectedAddressId)
        console.log("addres", address);
        return { address, order };

    } catch (error) {
        console.error("Error processing COD payment:", error);
        return res.status(500).send('Internal Server Error');
    }
}

async function processCardPayment(totalAmount, userId, selectedAddressId, cartItems, couponDiscount, coupon) {
    try {
        const options = {
            amount: totalAmount * 100,
            currency: 'INR',
            receipt: `order_rcptid_${Date.now()}`,
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);
        console.log("razorpayOrder", razorpayOrder);

        if (!razorpayOrder) {
            return res.status(500).send('Failed to create Razorpay order.');
        }
        const paymentLink = `https://rzp.io/pay/${razorpayOrder.id}`;
        // res.redirect(paymentLink)
        const orderNumber = await generateOrderNumber();
        const orderItems = await getOrderItems(cartItems);
        const order = new Order({
            orderNumber: orderNumber,
            user: userId,
            items: orderItems,
            totalAmount: totalAmount,
            address: selectedAddressId,
            paymentMethod: 'Cards',
            razorpayOrderId: razorpayOrder.id,
            status: 'Pending',
            couponDiscount: couponDiscount,
            couponCode: coupon ? coupon.code : null
        });
        console.log("order", order);
        // const paymentLink = `https://rzp.io/pay/${order.id}`;
        await order.save();

        return {
            razorpayOrder,
            orderData: order,
            orderId: order._id
        };

    } catch (error) {
        console.error('Error processing card payment:', error);
        return res.status(500).send('Internal Server Error');
    }
}
//Handle wallet payment

async function processWalletPayment(totalAmount, userId, selectedAddressId, cartItems, couponDiscount) {
    try {    
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return { error: true, status: 404, message: 'Wallet not found for this user.' };
        }

        const walletBalance = wallet.balance;

        if (walletBalance < totalAmount) {
            return { error: true, status: 400, message: 'Insufficient wallet balance.' };
        }

      
        wallet.balance -= totalAmount;
        const transactionId = await generateTransactionId();
        console.log("transactionId", transactionId);

        const orderNumber = await generateOrderNumber();
        const orderItems = await getOrderItems(cartItems); 

        const order = new Order({
            orderNumber: orderNumber,
            user: userId,
            items: orderItems,
            totalAmount: totalAmount,
            address: selectedAddressId,
            paymentMethod: 'Wallet',
            status: 'Paid',
            couponDiscount: couponDiscount
        });

        await order.save(); 
        console.log("Order created:", order);

      
        const walletTransaction = {
            transactionId: transactionId,
            type: 'Debit', 
            amount: totalAmount,
            description: `Order payment using wallet for order number ${orderNumber}`,
            date: new Date(),
            orderId: order._id  
        };

      
        wallet.transactions.push(walletTransaction);
        await wallet.save();

        console.log("Wallet updated with debit transaction:", walletTransaction);

        return { error: false, order };  

    } catch (error) {
        console.error('Error processing wallet payment:', error);
        return { error: true, status: 500, message: 'Internal Server Error' };
    }
};

async function generateOrderNumber() {
    const timestamp = Date.now(); 
    const randomSuffix = Math.floor(Math.random() * 1000);
    return `#${timestamp}${randomSuffix}`;
}

async function getOrderItems(cartItems) {
    try {
        return await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.product._id);

            if (!product) {
                return res.status(404).send(`Product with ID ${item.product._id} not found.`);
            }

            const prodImage = product.prodImages.length > 0 ? product.prodImages[0] : '';
            const offerDiscount = product.activeOffer
                ? (product.price - product.offerDiscountedPrice) * item.quantity : 0;
            return {
                product: product._id,
                prodName: product.name,
                prodImage: prodImage, 
                quantity: item.quantity,
                price: product.price,
                itemStatus: 'Pending', 
                offerDiscount
            };
        }));
    } catch (error) {
        console.error("Error fetching order items:", error);
        return res.status(500).send('Internal Server Error');
    }
}
async function getOrderedAddress(userId, selectedAddressId) {
    const orderedAddress = await User.findById(userId).populate('addresses');
    const address = orderedAddress.addresses.id(selectedAddressId);
    return address
}
async function generateTransactionId() {

    const letters = Array(3).fill(null).map(() => {
        return String.fromCharCode(65 + Math.floor(Math.random() * 26)); 
    }).join('');


    const timestamp = Date.now().toString(); 

    const randomDigits = Math.floor(1000 + Math.random() * 9000); 

    return `${letters}${timestamp}${randomDigits}`;
}

module.exports = {
    handleCODPayment,
    processCardPayment, processWalletPayment
};