const User = require("../../models/userModel")
const Cart = require("../../models/cartModel")
const Order = require("../../models/orderModel")
const Product = require("../../models/productModel")
const Coupon = require("../../models/couponModel")
const Wallet = require("../../models/walletModel")
const paymentController = require('../../controllers/user/paymentController');
const Razorpay = require("razorpay");
const crypto = require('crypto');
const mongoose = require('mongoose');
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env
// Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

const loadOrderSummary = async (req, res) => {
    console.log(req.session.user_id);
    console.log(req.params)
    try {
        const userId = req.session.user_id;
        if (!userId) {
            console.error("User ID not found in session.");
            return res.redirect('/login');
        }
        const orderId = req.params.orderId;
        if (!orderId) {
            console.error("Order ID is missing.");
            return res.status(400).send("Order ID is required.");
        }
        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            console.error("Order not found:", orderId);
            return res.status(404).send("Order not found.");
        }
        console.log("order", order)
        const addressId = order.address;
        const selectedAddress = order.user.addresses.find(address => address._id.equals(addressId))
        if (!selectedAddress) {
            console.error("Selected address not found for order:", orderId);
            return res.status(404).send("Address not found for this order.");
        }
        console.log("selectedAddress", selectedAddress)
        // const cartItems = order.items;
        // console.log("cartItems", cartItems)
        const { qty, totalAmount, discount } = order.items.reduce((acc, item) => {
            acc.qty += item.quantity;
            acc.totalAmount += item.price * item.quantity;
            if (item.offerDiscount > 0) {
                acc.discount += (item.offerDiscount / item.quantity) * item.quantity;
            }
            return acc;
        }, { qty: 0, totalAmount: 0, discount: 0 })
        const totalAfterOfferDisc = totalAmount - discount;
        console.log("totalAfterOfferDisc", totalAfterOfferDisc);
        let totalDiscount = discount;
        console.log("qty-totalAmount-totalDiscount", qty, totalAmount, totalDiscount)

        let totalAfterDisc = totalAfterOfferDisc;
        if (order.couponDiscount > 0) {
            totalDiscount += order.couponDiscount
            totalAfterDisc -= order.couponDiscount
            console.log("totalDiscount", totalDiscount);
            console.log("totalAfterDisc", totalAfterDisc);

        }
        // Fetch available coupons only if no coupon discount is applied
        const coupons = (order.couponDiscount > 0) ? [] : await Coupon.find({
            usedBy: { $nin: [userId] },
            isActive: true,
        });

        // Fetch user's wallet
        const wallet = await Wallet.findOne({ userId });

        // Check if wallet exists
        const newBalance = wallet ? wallet.balance : 0; // Default to 0 if wallet doesn't exist

        res.render('order-summary', {
            selectedAddress,
            orders: order,
            totalAmount,
            totalDiscount,
            totalAfterDisc,
            qty,
            coupons,
            newBalance,
        });
    }
    catch (err) {
        console.error('Error loading order summary:', err);
        res.status(500).send("Internal Server Error. Please try again later.");
    }
}

const selectAddressForOrder = async (req, res) => {
    console.log(req.session);
    try {
        const { selectedAddress: selectedAddressId } = req.body;
        const { user_id: userId } = req.session;

        // Fetch user and populate addresses
        const user = await User.findById(userId).populate('addresses');
        if (!user || !user.addresses.length) {
            console.error("User not found or no addresses available.");
            return res.redirect('/checkout');
        }
        const selectedAddress = user.addresses.id(selectedAddressId);
        if (!selectedAddress) {
            console.error("Selected address not found:", selectedAddressId);
            return res.redirect('/checkout');
        }
        // Fetch user's cart
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            model: 'Product',
            select: 'name price offerDiscountedPrice',
        });
        console.log("cart", cart);

        // Check if cart exists and has items
        if (!cart || !cart.items || cart.items.length === 0) {
            console.error("Cart is empty or does not exist");
            return res.redirect('/checkout'); // Redirect if cart is empty
        }

        // Calculate total quantity, amount, discounts, and total after discount
        let qty = 0;
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalAfterDisc = 0;

        const cartItems = cart.items.map(item => {
            console.log("item", item);

            if (!item.product || !item.product.name) {
                // throw new Error("Product not found or not populated correctly");
                return res.status(400).send('Product not found or not populated correctly.');
            }

            // Use offerDiscountPrice if it exists, otherwise use the regular price
            const regularPrice = item.product.price;
            const discountedPrice = item.product.offerDiscountedPrice || regularPrice; // If no discount, use regular price

            // Calculate discount if applicable
            const discount = regularPrice - discountedPrice;

            return {
                ...item.toObject(),
                effectivePrice: discountedPrice, // Add the effective price for use later
                discount: discount > 0 ? discount : 0, // Store the discount for each item
                regularPrice: regularPrice // Store regular price for total calculation
            };
        });

        cartItems.forEach(order => {
            console.log("order", order);

            qty += order.quantity; // Track total quantity

            if (order.product) {
                totalAmount += order.regularPrice * order.quantity; // Total amount without discount
                totalAfterDisc += order.effectivePrice * order.quantity; // Total after discount
                totalDiscount += order.discount * order.quantity; // Total discount
            } else {
                console.error("Order product is undefined for", order); // Log an error if product is missing
            }
        });

        console.log("cartItems", cartItems);
        console.log("Total Amount:", totalAmount);
        console.log("Total After Discount:", totalAfterDisc);
        console.log("Total Discount:", totalDiscount);

        // Store total amounts in session
        req.session.totalAmount = totalAmount;
        req.session.totalAfterDisc = totalAfterDisc;
        req.session.totalDiscount = totalDiscount;

        // Fetch available coupons
        const coupons = await Coupon.find({
            usedBy: { $nin: [userId] },
            isActive: true,
        });

        // Fetch user's wallet
        const wallet = await Wallet.findOne({ userId });

        // Check if wallet exists
        const newBalance = wallet ? wallet.balance : 0; // Default to 0 if wallet doesn't exist

        // Render order summary page
        res.render('order-summary', {
            selectedAddress,
            orders: cartItems,
            totalAmount,
            totalDiscount,
            totalAfterDisc,
            qty,
            coupons,
            newBalance,
        });
    } catch (err) {
        console.error("Error in loading order summary:", err);
        res.redirect('/checkout'); // Redirect on error
    }
};

const applyCoupon = async (req, res) => {
    console.log("coupon", req.body);
    try {
        const couponCode = req.body.couponCode.trim();
        const userId = req.session.user_id
        const originalTotal = req.session.totalAmtAftDisc
        const coupon = await Coupon.findOne({ code: couponCode })
        const totalAmount = req.session.totalAmount
        req.session.couponCode = couponCode;
        console.log("coupon", coupon);
        console.log("userId", userId);
        console.log("originalTotal", originalTotal);
        console.log("totalAmount", totalAmount);
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code' });
        }
        if (coupon.usedBy.includes(userId)) {
            return res.json({ success: false, message: 'You have already used this coupon.' });
        }
        if (originalTotal < coupon.minAmount) {
            return res.json({ success: false, message: `You need to purchase items above Rs ${coupon.minAmount} to use this coupon.` });
        }
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (coupon.discountValue / 100) * originalTotal;
        } else if (coupon.discountType === 'flat') {
            discount = coupon.discountValue;
        }
        if (coupon.maxAmount && discount > coupon.maxAmount) {
            discount = coupon.maxAmount;
        }
        const newTotal = originalTotal - discount;
        req.session.couponDiscount = discount
        console.log("discount", discount);
        console.log("newTotal", newTotal);
        // Store the original total before applying any discount
        if (!req.session.originalTotal) {
            req.session.originalTotal = originalTotal;
        }
        await Coupon.updateOne(
            { _id: coupon._id },
            { $addToSet: { usedBy: mongoose.Types.ObjectId(userId) } }
        )

        // After calculating the discount and new total:
        req.session.totalAmtAftDisc = newTotal;  // Assign the new total to the session
        console.log("Updated session totalAmtAftDisc:", req.session.totalAmtAftDisc); // Should log new total

        // Save the session explicitly if needed
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).json({ success: false, message: 'Error saving session' });
            }
            return res.json({ success: true, discount, originalTotal, newTotal, couponCode });
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Error applying coupon' });
    }
}
const removeCoupon = async (req, res) => {
    try {
        const couponCode = req.body.couponCode.trim();
        const userId = req.session.user_id
        const originalTotal = req.session.originalTotal;
        const totalAmtAftDisc = req.session.totalAmtAftDisc
        const couponDiscountAmt = req.session.couponDiscount
        if (!originalTotal) {
            return res.json({ success: false, message: 'Original total not found, cannot remove coupon.' });
        }
        // Find the coupon
        const coupon = await Coupon.findOne({ code: couponCode });
        console.log('Found coupon:', coupon);
        console.log('Coupon usedBy:', coupon.usedBy);
        console.log('User ID:', userId);
        console.log(originalTotal);
        console.log(totalAmtAftDisc);
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code' });
        }

        // Check if the coupon is already used
        if (!coupon.usedBy.includes(userId)) {
            return res.json({ success: false, message: 'Coupon not applied or already removed.' });
        }

        // Remove the user from the usedBy array
        await Coupon.updateOne(
            { _id: coupon._id },
            { $pull: { usedBy: mongoose.Types.ObjectId(userId) } }
        );
        req.session.totalAmtAftDisc = originalTotal
        res.json({ success: true, originalTotal, discount: couponDiscountAmt, message: 'Coupon removed successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Error removing coupon' });
    }
}
const applyRepayCoupon = async (req, res) => {
    const { couponCode, orderId } = req.body; // Get the coupon code from the request body
    const userId = req.session.user_id; // Get the user ID from the session

    try {
        // Fetch the order details using the userId (you may need to adjust the query based on your schema)
        const order = await Order.findOne({ _id: orderId, status: 'Pending' }); // Adjust query to find the relevant order

        if (!order) {
            return res.json({ success: false, message: 'No pending order found.' });
        }

        const originalTotal = order.totalAmount; // Get the original total from the order
        const coupon = await Coupon.findOne({ code: couponCode });

        // Check if the coupon exists
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code.' });
        }

        // Check if the user has already used this coupon
        if (coupon.usedBy.includes(userId)) {
            return res.json({ success: false, message: 'You have already used this coupon.' });
        }

        // Check if the order total meets the minimum amount requirement for the coupon
        if (originalTotal < coupon.minAmount) {
            return res.json({ success: false, message: `You need to purchase items above Rs ${coupon.minAmount} to use this coupon.` });
        }

        // Calculate the discount based on coupon type
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (coupon.discountValue / 100) * originalTotal;
        } else if (coupon.discountType === 'flat') {
            discount = coupon.discountValue;
        }

        // Cap discount if it exceeds maxAmount
        if (coupon.maxAmount && discount > coupon.maxAmount) {
            discount = coupon.maxAmount;
        }

        // Calculate the new total
        const newTotal = originalTotal - discount;

        // Update the order with the new total and coupon code
        await Order.updateOne(
            { _id: order._id },
            { totalAmount: newTotal, couponCode: couponCode, couponDiscount: discount }
        );

        // Update the coupon to mark it as used by the user
        await Coupon.updateOne(
            { _id: coupon._id },
            { $addToSet: { usedBy: mongoose.Types.ObjectId(userId) } }
        );

        // Respond with success and details
        return res.json({ success: true, discount, originalTotal, newTotal, couponCode });
    } catch (err) {
        console.error('Error applying coupon for repayment:', err);
        return res.status(500).json({ success: false, message: 'Error applying coupon for repayment.' });
    }
};

const addMoneyToWallet = async (req, res) => {
    console.log("us", req.session.user_id);
    console.log(req.body.amount);
    try {
        const userId = req.session.user_id
        const amountToAdd = parseFloat(req.body.amount)
        if (isNaN(amountToAdd) || amountToAdd <= 0) {
            return res.status(400).json({ success: false, message: "Please enter a valid amount." });
        }
        // Create Razorpay Order
        const options = {
            amount: amountToAdd * 100, // Amount in paise
            currency: 'INR',
            receipt: `wallet_${userId.slice(0, 10)}_${Date.now().toString().slice(-5)}`,
            payment_capture: 1 // Auto-capture payment
        };

        const order = await razorpayInstance.orders.create(options);
        console.log("order", order);


        // Send the Razorpay order details to the client
        res.json({
            success: true,
            razorpayOrderId: order.id,
            razorpayKeyId: RAZORPAY_ID_KEY,
            amount: amountToAdd
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "An error occurred while adding money." });
    }
}
const verifyAndAddMoneyToWallet = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
        console.log("body", req.body);
        console.log("Received amount:", amount);
        const userId = req.session.user_id;
        const amountToAdd = parseFloat(amount);
        if (isNaN(amountToAdd) || amountToAdd <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount." });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in." });
        }

        // Verify the payment signature (optional but recommended)
        const isValidSignature = verifyPaymentSignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });
        console.log("isValidSignature", isValidSignature);

        if (!isValidSignature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature." });
        }

        // Find user's wallet and add the money
        let wallet = await Wallet.findOne({ userId });
        console.log("wallet", wallet);

        const transactionId = await generateTransactionId();

        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: amountToAdd,
                transactions: [{
                    transactionId,
                    amount: amountToAdd,
                    description: `Added ₹${amount} to wallet via Razorpay.`,
                    type: 'Credit',
                    date: new Date(),
                    orderId: null
                }]
            });
        } else {
            wallet.balance += parseFloat(amount);
            wallet.transactions.push({
                transactionId,
                amount: amountToAdd,
                description: `Added ₹${amount} to wallet via Razorpay.`,
                type: 'Credit',
                date: new Date(),
                orderId: null
            });
        }

        await wallet.save();

        // Respond with success
        res.json({ success: true, message: `₹${amount} added to your wallet.`, newBalance: wallet.balance });
    } catch (error) {
        console.error('Error verifying payment or updating wallet:', error);
        res.status(500).json({ success: false, message: "Failed to verify payment and add money to wallet." });
    }
};

const verifyPaymentSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET_KEY);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');
    return generatedSignature === razorpay_signature;
};
const placeOrder = async (req, res) => {
    console.log("body", req.body);
    const { selectedAddressId, totalAmount, paymentMethod } = req.body;
    const couponCodeTrimmed = req.session.couponCode;
    console.log("couponCodeTrimmed", couponCodeTrimmed);
    const userId = req.session.user_id;
    const couponDiscount = req.session.couponDiscount || 0;
    console.log("user", userId);
    console.log("couponDisc", req.session.couponDiscount);
    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        console.log("cart", cart);
        if (!cart) {
            return res.redirect('/checkout');
        }
        const parsedTotalAmount = parseFloat(totalAmount);
        console.log(parsedTotalAmount);

        if (isNaN(parsedTotalAmount)) {
            return res.status(400).send('Invalid total amount.');
        }
        const user = await User.findById(userId).populate('addresses');
        if (!user) {
            console.error("User not found:", userId);
            return res.status(404).send('User not found.');
        }
        console.log("user", user);
        const selectedAddress = user.addresses.id(selectedAddressId);
        if (!selectedAddress) {
            console.error("Selected address not found:", selectedAddressId);
            return res.status(404).send('Address not found.');
        }
        console.log("addres", selectedAddress);
        const coupon = await Coupon.findOne({ code: couponCodeTrimmed })
        console.log("coupon", coupon);
        let order, razorpayOrder;

        if (paymentMethod === 'COD') {
            if (parsedTotalAmount > 1000) {
                return res.status(400).send('COD is not available for orders above ₹1000.');
            }

            const { address, order: codOrder } = await paymentController.handleCODPayment(cart, userId, selectedAddressId, parsedTotalAmount, couponDiscount);
            // await Coupon.updateOne(
            //     {_id:coupon._id},
            //     {$addToSet:{ usedBy: mongoose.Types.ObjectId(userId)}}
            // )
            await updateProductStock(codOrder.items);
            order = codOrder;
            console.log("ordercod", order);
            // console.log("address",address);ddress });

        } else if (paymentMethod === 'Cards') {
            const { razorpayOrder: rzpOrder, orderData, orderId } = await paymentController.processCardPayment(parsedTotalAmount, userId, selectedAddressId, cart.items, couponDiscount, coupon);
            razorpayOrder = rzpOrder;
            order = orderData;
            console.log("cardorder", order);
            // req.session.orderId = orderId;
            req.session.order = orderData; // Storing the orderData in session
            // Send response with Razorpay order ID and total amount
            return res.json({
                razorpayOrderId: razorpayOrder.id,
                totalAmount: parsedTotalAmount,
                razorpayKeyId: RAZORPAY_ID_KEY,
                address: selectedAddress,
                orderId: orderId
            });

        } else if (paymentMethod === 'Wallets') {
            const { order: walletOrder, error } = await paymentController.processWalletPayment(parsedTotalAmount, userId, selectedAddressId, cart.items);
            if (error) {
                return res.status(error.status).send(error.message);
            }
            cart.items = [];
            await cart.save();
            await updateProductStock(walletOrder.items);
            order = walletOrder;
        } else {
            return res.status(400).send('Invalid payment method');
        }

        res.render('order-confirmation', {
            order: order,
            address: selectedAddress,
            razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
            razorpayKeyId: RAZORPAY_ID_KEY
        });

    } catch (err) {
        console.error('Error processing payment:', err);
        res.status(500).send('Internal Server Error');
    }
};

const cardPayment = async (req, res) => {
    try {
        console.log('hii');
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
        const userId = req.session.user_id
        console.log("orderId", orderId);
        console.log("razorpay_signature", razorpay_signature);
        console.log("razorpay_order_id", razorpay_order_id);
        const hmac = crypto.createHmac('sha256', RAZORPAY_SECRET_KEY);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id)
        const expectedSignature = hmac.digest('hex');
        if (expectedSignature === razorpay_signature) {
            console.log("expectedSignature", expectedSignature);
            // Payment verified, process the order
            // const orderId = req.session.orderId;
            if (!orderId) {
                return res.status(400).json({ success: false, message: "Order ID not found in session" });
            }
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            console.log("orddd", order);
            if (!order) {
                console.log('Order not found for:', razorpay_order_id);
                return res.json({ success: false, message: 'Order not found' });
            }
            // Proceed with updating order details and stock
            order.razorpay_payment_id = razorpay_payment_id;
            order.status = 'Paid';
            await order.save();

            await updateProductStock(order.items);
            await Cart.findOneAndDelete({ user: userId });
            // return res.redirect(`/order-confirmation?orderId=${order._id}`);
            res.json({ success: true, orderId: order._id });
        } else {
            console.log('Payment verification failed:', {
                expectedSignature,
                receivedSignature: razorpay_signature
            });
            return res.json({ success: false, message: "Payment verification failed" });
        }
    }
    catch (err) {
        console.log("errorfail", err);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

// async function handleCODPayment(cart, userId, selectedAddressId, totalAmount) {
//     try {
//         // Prepare order items with product details
//         const orderItems = await Promise.all(cart.items.map(async (item) => {
//             const product = await Product.findById(item.product._id);

//             if (!product) {
//                 throw new Error(`Product with ID ${item.product._id} not found.`);
//             }

//             // Choose the first image if there are multiple
//             const prodImage = product.prodImages.length > 0 ? product.prodImages[0] : '';

//             return {
//                 product: product._id,
//                 prodName: product.name,
//                 prodImage: prodImage, // Include product image
//                 quantity: item.quantity,
//                 price: product.price,
//                 itemStatus: 'Pending'
//             };
//         }));

//         console.log("orderItems", orderItems);

//         // Generate unique order number
//         const orderNumber = await generateOrderNumber();
//         const order = new Order({
//             orderNumber: orderNumber,
//             user: userId,
//             items: orderItems,
//             totalAmount: totalAmount,
//             address: selectedAddressId,
//             paymentMethod: 'COD',
//             status: 'Pending'
//         });

//         console.log("order", order);

//         // Save the order
//         await order.save();
//         // Clear the cart after order is placed
//         // await Cart.findByIdAndUpdate(cart._id, { items: [] });

//         // Fetch the address of the user
//         const orderedAddress = await User.findById(userId).populate('addresses');
//         const address = orderedAddress.addresses.id(selectedAddressId);

//         console.log("popOrder", address);

//         return { address, order };

//     } catch (error) {
//         console.error("Error processing COD payment:", error);
//         throw error; // Propagate error to be handled by the caller
//     }
// }

async function updateProductStock(items) {
    for (const item of items) {
        await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: -item.quantity } },
            { new: true }
        )
    }
}
const loadOrderConfirmation = async (req, res) => {
    console.log(req.query);
    try {
        const orderId = req.query.orderId; // Assuming orderId is passed in the query params after payment
        if (!orderId) {
            return res.status(400).send('Order ID is required');
        }
        const order = await Order.findById(orderId); // Retrieve the order from the database
        console.log('orderload', order);

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        // Fetch the user to get the address
        const user = await User.findById(order.user); // Assuming order has a userId field
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Find the specific address from the address array
        const address = user.addresses.id(order.address); // Use Mongoose's `id` method to find the address
        console.log("address", address);

        if (!address) {
            return res.status(404).send('Address not found');
        }
        // res.render('order-confirmation', { order,address,razorpayKeyId: RAZORPAY_ID_KEY});
        res.render('order-confirmation', {
            order,
            address,
            razorpayOrderId: order.razorpayOrderId,
            razorpayKeyId: RAZORPAY_ID_KEY
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
}
async function generateTransactionId() {
    // Generate 3 random uppercase letters
    const letters = Array(3).fill(null).map(() => {
        return String.fromCharCode(65 + Math.floor(Math.random() * 26)); // ASCII 65-90 for 'A'-'Z'
    }).join('');

    // Get the current timestamp as a string
    const timestamp = Date.now().toString(); // Milliseconds since epoch

    // Generate 4 random digits
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // Generates a 4-digit number

    // Combine letters, timestamp, and random digits to form the transaction ID
    return `${letters}${timestamp}${randomDigits}`;
}
module.exports = {
    loadOrderSummary, selectAddressForOrder, placeOrder, loadOrderConfirmation,
    cardPayment, applyCoupon, removeCoupon, addMoneyToWallet, applyRepayCoupon,
    verifyAndAddMoneyToWallet
}