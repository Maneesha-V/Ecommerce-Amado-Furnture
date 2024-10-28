const User = require("../../models/userModel");
const Product = require("../../models/productModel");
const Order = require("../../models/orderModel");
const Wallet = require("../../models/walletModel");
const bcrypt = require("bcrypt");
const pdf = require('html-pdf');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const Razorpay = require("razorpay");
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const loadOrder = async (req, res) => {
    try {
        const userId = req.session.user_id
        const orders = await Order.find({ user: userId })
            .populate('items')
            .exec();
        orders.forEach(order => {
            console.log("Order ID:", order._id);
            console.log("Order Items:", order.items);  // Logs items for each order
        });
        console.log("order", orders);
        res.render('partials/orders', { orders })
    }
    catch (err) {
        console.error('Error loading orders:', err);
        return res.status(500).render('500', {
            status: 500,
            message: 'Server error. Please try again later.'
        });
    }
}
const loadOrderStatus = async (req, res) => {
    const userId = req.session.user_id
    const orderId = req.params.orderId
    console.log("user,prod", userId, orderId);
    try {
        const order = await Order.findById(orderId).populate('user')
        if (!order) {
            return res.status(404).render('404', { message: 'Order not found' });
        }
        console.log("orderstat", order);
        const addressId = order.address
        const matchingAddress = order.user.addresses.find(addr => addr._id.equals(addressId))
        if (!matchingAddress) {
            return res.status(404).render('404', { message: 'Address not found for this order' });
        }
        console.log("address", matchingAddress);
        res.render('partials/order-status', { order, address: matchingAddress })
    }
    catch (err) {
        console.error('Error loading order status:', err);
        return res.status(500).render('500', { message: 'Server error. Please try again later.' });
    }
}
const removeItemFromPlacedOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user_id;
        console.log("params", req.params);
        const orderStatus = req.body.orderStatus;
        console.log("orderStatus", orderStatus);
        const cancellationReason = req.body.reason;
        const order = await Order.findById(orderId);
        console.log("order", order);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }
        console.log("item found", item);

        if (item.isRefunded) {
            return res.status(400).json({
                success: false,
                message: `Item ${item.prodName} has already been refunded.`
            });
        }

        // Update the item's status to 'Canceled'
        item.itemStatus = 'Canceled';
        item.reason = cancellationReason;
        // Check if all items are canceled to mark the whole order as 'Canceled' later
        const allItemsCanceled = order.items.every(item => item.itemStatus === 'Canceled');

        // Process refund before modifying order status
        if (order.status === 'Paid') {
            let wallet = await Wallet.findOne({ userId });
            // console.log("wallet", wallet);
            const transactionId = await generateTransactionId();
            if (!wallet) {
                // Create a new wallet if one doesn't exist
                wallet = new Wallet({
                    userId,
                    balance: item.price,
                    transactions: [{
                        transactionId,
                        amount: item.price,
                        description: `Refund for canceled item: ${item.prodName}`,
                        type: 'Canceled',
                        date: new Date(),
                        orderId: order._id
                    }]
                });
                await wallet.save();
                console.log("New wallet created and refund added.");

            } else {
                // Add the refund to the existing wallet balance
                wallet.balance += item.price;
                wallet.transactions.push({
                    transactionId,
                    amount: item.price,
                    description: `Refund for canceled item: ${item.prodName}`,
                    type: 'Canceled',
                    date: new Date(),
                    orderId: order._id
                });
                await wallet.save();
                console.log("Refund added to existing wallet.");
            }

            // Mark the item as refunded to avoid double refunding
            item.isRefunded = true;
        }

        // Now update the order status
        if (allItemsCanceled) {
            order.status = 'Canceled'; // If all items are canceled, cancel the entire order
            order.canceledAt = new Date(); // Set the cancellation timestamp
            console.log("Order canceled at", order.canceledAt);
        } else {
            // If there are multiple items, subtract the canceled item's price from total
            order.totalAmount -= item.price;
            order.statusUpdatedAt = new Date(); // Track when the status was updated
        }

        // Save the order with updated status and total
        await order.save();

        // Send success response with wallet update if applicable
        return res.json({
            success: true,
            message: `Item ${item.prodName} canceled successfully.`,
            itemStatus: item.itemStatus
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "An error occurred while canceling the item." });
    }
};


const returnItemFromPlacedOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user_id;
        console.log("params-return", req.params);
        console.log("body", req.body);
        const returnedReason = req.body.reason;

        const order = await Order.findById(orderId);
        console.log("order", order);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.items.id(itemId);
        console.log("item", item);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in the order" });
        }

        // Check if the item has already been refunded
        if (item.isRefunded) {
            return res.status(400).json({
                success: false,
                message: `Item ${item.prodName} has already been refunded.`
            });
        }

        // Check if the item is eligible for return
        if (item.itemStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Item is not eligible for return" });
        }

        // Check if the return has been approved
        // if (item.returnStatus !== 'Approved') {
        //     return res.status(400).json({ success: false, message: "Return request is not approved yet." });
        // }
        // Update the item status and reason for return
        // item.itemStatus = 'Delivered'
        item.returnStatus = 'Pending';
        item.reason = returnedReason;
        await order.save();
        return res.json({
            success: true,
            message: "Return request sent. Awaiting admin approval.",
            itemStatus: item.itemStatus,
            returnStatus: item.returnStatus
        });

    } catch (err) {
        console.log("Error while processing return request", err);
        res.status(500).json({ success: false, message: "An error occurred while processing the refund." });
    }
};

//wallet
const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user_id;
        console.log("user", userId);

        // Fetch wallet for the given user
        const wallet = await Wallet.findOne({ userId: userId });
        console.log("wallet", wallet);

        // Check if wallet exists for the user
        if (!wallet) {
            return res.render('partials/wallet', {
                user: {
                    walletBalance: 0, // Default balance
                    walletTransactions: [] // No transactions
                }
            });
        }
        const walletBalance = wallet.balance
        // Filter out only the transactions of type 'Canceled'
        const canceledTransactions = wallet.transactions.filter(item => item.type === 'Canceled');
        for (const transaction of canceledTransactions) {
            const order = await Order.findById(transaction.orderId)
            console.log("order", order);
            const canceledItem = order.items.find(item => item.itemStatus === 'Canceled')
            console.log("canceledItem", canceledItem);
            if (canceledItem) {
                transaction.reason = canceledItem.reason
            }
        }
        console.log("canceledTransactions", canceledTransactions);
        console.log("walletBalance", walletBalance);
        res.render('partials/wallet', {
            user: {
                walletBalance: walletBalance,
                walletTransactions: canceledTransactions
            }
        })

    } catch (err) {
        console.log(err);
        res.render('partials/wallet', { message: "An error occurred while loading the wallet" });
    }
}
//change-password
const getChangePassword = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        res.render('partials/change-password', { user });
    } catch (err) {
        console.log(err);
        res.status(500).render('partials/change-password', {
            user: null,
            message: "An error occurred while loading the change password page."
        });
    }
};

const updateChangePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user_id;
        const user = await User.findById(userId);
        console.log("useer", user);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if the user logged in via Google
        if (user.googleId) {
            if (newPassword !== confirmPassword) {
                // return res.render('partials/change-password', {
                //     user,
                //     message: "New password and confirm password do not match",
                // });
                return res.status(400).json({ message: "New password and confirm password do not match" });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword; // Set the new password
            await user.save();

            return res.status(200).json({ message: "Password set successfully" });
        } else {
            // For non-Google users, proceed with current password verification
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Incorrect current password" });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: "New password and confirm password do not match" });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            await user.save();
            return res.status(200).json({ message: "Password updated successfully" });

        }
    } catch (err) {
        console.log("Error updating password", err);
        return res.status(500).json({ message: "An error occurred while updating the password" });
    }
};
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

const downloadInvoice = async (req, res) => {
    console.log(req.params);
    try {
        const userId = req.session.user_id;
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('user');
        console.log("order", order);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const addressId = order.address;
        const shippingAddress = order.user.addresses.find(address => address._id.equals(addressId));
        console.log("shippingAddress", shippingAddress);

        // Correct path to your invoice HTML template
        const invoiceTemplatePath = path.join(__dirname, '../../views/users/invoice-template.ejs');

        // Render the HTML using EJS
        const htmlContent = await ejs.renderFile(invoiceTemplatePath, {
            order: order,  // Pass the order data to the template
            shippingAddress: shippingAddress
        });

        // const html = await ejs.renderFile(path.join(__dirname, '../../views/users/invoice-template.ejs'), { order });
        const options = {
            format: 'A4',
            border: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        };

        pdf.create(htmlContent, options).toStream((err, stream) => {
            if (err) {
                console.error('Error while generating PDF:', err);
                res.redirect("/pageNotfound")
            }
            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-Disposition', attachment; filename=Invoice_${order.orderId}.pdf);
            res.setHeader('Content-disposition', `attachment; filename="invoice-${orderId}.pdf"`);
            res.setHeader('Content-type', 'application/pdf');
            stream.pipe(res);
        });

    } catch (err) {
        console.log("Error generating PDF:", err);
        res.status(500).send('Internal Server Error');
    }
};

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

const orderRepayment = async (req, res) => {
    console.log(req.params);
    try {
        const userId = req.session.user_id;
        console.log("userId", userId);

        const orderId = req.params.orderId; // Extract orderId from route params
        const { selectedAddressId, totalAmount, paymentMethod } = req.body; // Extract data from request body
        console.log("paymentMethod, selectedAddressId, totalAmount:", paymentMethod, selectedAddressId, totalAmount);
        // Validate and find the order by orderId
        const order = await Order.findById(orderId);
        console.log("order", order);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.status !== 'Pending') {
            return res.status(400).json({ error: 'Order is not in a pending state for repayment.' });
        }
        const user = await User.findById(userId).populate('addresses');
        // console.log("user", user);
        const selectedAddress = user.addresses.id(selectedAddressId);
        console.log("addres", selectedAddress);
        // Proceed to create a Razorpay order
        const options = {
            amount: totalAmount * 100, // Convert to paise
            currency: 'INR',
            receipt: `receipt#${orderId}`, // Optional: Unique receipt ID
            payment_capture: 1, // Auto capture payment
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);
        console.log('Razorpay Order:', razorpayOrder);
        order.razorpayOrderId = razorpayOrder.id; // Save Razorpay order ID in your order model
        order.paymentMethod = paymentMethod; // Save the payment method used
        await order.save();
        console.log("ordernew", order);

        res.json({
            razorpayOrderId: razorpayOrder.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID, // Ensure you have your Razorpay key ID in the environment variables
            address: {
                name: selectedAddressId.name,
                email: selectedAddressId.email || 'example@example.com' // Use email from selected address if available
            },
            orderId: order._id
        });

    }
    catch (err) {
        console.log("Error in order repayment", err);
        return res.status(500).json({ error: 'Repayment Internal server error' });
    }
}
module.exports = {
    loadOrder, loadOrderStatus, removeItemFromPlacedOrder, returnItemFromPlacedOrder,
    getChangePassword, updateChangePassword, loadWallet, downloadInvoice, orderRepayment
}