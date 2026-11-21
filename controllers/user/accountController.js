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
            console.log("Order Items:", order.items);  
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

        item.itemStatus = 'Canceled';
        item.reason = cancellationReason;
    
        const allItemsCanceled = order.items.every(item => item.itemStatus === 'Canceled');

        if (order.status === 'Paid') {
            let wallet = await Wallet.findOne({ userId });

            const transactionId = await generateTransactionId();
            if (!wallet) {

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

            item.isRefunded = true;
        }

        if (allItemsCanceled) {
            order.status = 'Canceled'; 
            order.canceledAt = new Date();
            console.log("Order canceled at", order.canceledAt);
        } else {
            order.totalAmount -= item.price;
            order.statusUpdatedAt = new Date();
        }

        await order.save();

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

        if (item.isRefunded) {
            return res.status(400).json({
                success: false,
                message: `Item ${item.prodName} has already been refunded.`
            });
        }

        if (item.itemStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Item is not eligible for return" });
        }


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

        const wallet = await Wallet.findOne({ userId: userId });
        console.log("wallet", wallet);

        if (!wallet) {
            return res.render('partials/wallet', {
                user: {
                    walletBalance: 0, 
                    walletTransactions: [] 
                }
            });
        }
        const walletBalance = wallet.balance
   
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

        if (user.googleId) {
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: "New password and confirm password do not match" });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword; 
            await user.save();

            return res.status(200).json({ message: "Password set successfully" });
        } else {
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
    const letters = Array(3).fill(null).map(() => {
        return String.fromCharCode(65 + Math.floor(Math.random() * 26)); 
    }).join('');


    const timestamp = Date.now().toString(); 

    const randomDigits = Math.floor(1000 + Math.random() * 9000); 

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

        const invoiceTemplatePath = path.join(__dirname, '../../views/users/invoice-template.ejs');

        const htmlContent = await ejs.renderFile(invoiceTemplatePath, {
            order: order,  
            shippingAddress: shippingAddress
        });

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

            res.setHeader('Content-disposition', `attachment; filename="invoice-${orderId}.pdf"`);
            res.setHeader('Content-type', 'application/pdf');
            stream.pipe(res);
        });

    } catch (err) {
        console.log("Error generating PDF:", err);
        res.status(500).send('Internal Server Error');
    }
};

const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

const orderRepayment = async (req, res) => {
    console.log(req.params);
    try {
        const userId = req.session.user_id;
        console.log("userId", userId);

        const orderId = req.params.orderId; 
        const { selectedAddressId, totalAmount, paymentMethod } = req.body; 
        console.log("paymentMethod, selectedAddressId, totalAmount:", paymentMethod, selectedAddressId, totalAmount);
 
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

        const options = {
            amount: totalAmount * 100, 
            currency: 'INR',
            receipt: `receipt#${orderId}`, 
            payment_capture: 1, 
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);
        console.log('Razorpay Order:', razorpayOrder);
        order.razorpayOrderId = razorpayOrder.id; 
        order.paymentMethod = paymentMethod;
        await order.save();
        console.log("ordernew", order);

        res.json({
            razorpayOrderId: razorpayOrder.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID, 
            address: {
                name: selectedAddressId.name,
                email: selectedAddressId.email || 'example@example.com' 
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