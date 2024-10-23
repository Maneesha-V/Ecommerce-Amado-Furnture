const User = require("../../models/userModel")
const Order = require("../../models/orderModel")
const Wallet = require("../../models/walletModel")
const mongoose = require("mongoose")
const { ObjectId } = require("mongodb")
const loadOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const orders = await Order.find()
            .populate('user', 'firstname lastname email addresses')
            .populate({
                path: 'items.product',
                select: 'name price'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();
        console.log("ord", orders);
        // Total count of orders for pagination
        const totalCount = await Order.countDocuments();
        const totalPages = Math.ceil(totalCount / limit); // Calculate total pages
        orders.forEach(order => {
            const addressId = order.address
            const matchingAddress = order.user.addresses.find(addr => addr._id.equals(addressId))
            order.matchingAddress = matchingAddress
        })
        console.log("add", orders);
        res.render('orders', {
            orders,
            currentPage: page,
            totalPages
        })
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
}

const updateOrderStatus = async (req, res) => {
    console.log("Received orderId:", req.params.orderId);
    const { status } = req.body;
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
    }
    try {
        const order = await Order.findById(new ObjectId(orderId))

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Validate the status change
        if (order.status === 'Paid' && (status === 'Failed' || status === 'Pending')) {
            return res.status(400).json({ error: 'Cannot change status from Paid to Failed or Pending' });
        }

        if (order.status === 'Failed' && (status === 'Paid' || status === 'Pending')) {
            return res.status(400).json({ error: 'Cannot change status from Failed to Paid or Pending' });
        }

        const updateStatus = await Order.updateOne(
            { _id: orderId },
            { $set: { status: status } }
        );

        if (updateStatus.nModified === 0) {
            return res.status(400).json({ error: 'Order status unchanged or invalid transition' });
        }

        res.json({ message: 'Order status updated successfully' }); // Send success response
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred while updating the order status' });
    }
};

const getItemsInOrder = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findById(new ObjectId(orderId))
        console.log("order-items",order);
        res.render('items-status', { order })
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
}

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { status } = req.body;
        console.log("status", req.body);
        console.log("orderId ItemId", orderId, itemId);

        // Validate the new status
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Canceled', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }
        const order = await Order.findOne({ _id: orderId, "items._id": itemId })
        if (!order) {
            return res.status(404).json({ message: "Order or item not found." });
        }
        console.log("order", order);
        const item = order.items.id(itemId)
        const currentStatus = item.itemStatus
        // Prevent rolling back statuses
        const statusProgression = {
            'Pending': ['Processing', 'Canceled'],
            'Processing': ['Shipped', 'Canceled'],
            'Shipped': ['Delivered', 'Canceled'],
            'Delivered': ['Returned'],
            'Canceled': [], // No further progression
            'Returned': [] // No further progression
        };
        if (!statusProgression[currentStatus].includes(status)) {
            return res.status(400).json({ message: `Cannot revert status from ${currentStatus} to ${status}.` });
        }
        item.itemStatus = status
        await order.save()
        return res.status(200).json({ success: true, message: 'Status updated successfully.', orderId: order._id });
        // res.redirect(`/admin/items-status/${order._id}`);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Server error." });
    }
}
const manageReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const action = req.body.returnAction;
        console.log(req.body.returnAction);
        console.log(req.params);
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }


        if (action === 'Approve') {
            if (item.isRefunded) {
                return res.json({ success: false, message: "Item is already refunded." });
            }
            item.returnStatus = 'Approved';
            item.itemStatus = 'Returned';

            // Process the wallet refund
            const userId = order.user
            console.log("userId", userId);

            const refundResult = await processWalletRefund(userId, item, order);
            if (!refundResult.success) {
                return res.json({ success: false, message: refundResult.message });
            }
        } else if (action === 'Reject') {
            item.returnStatus = 'Rejected';
            // Optionally update `item.itemStatus` if needed
        }

        await order.save();
        return res.json({ success: true, message: `Return request ${action}d successfully.` });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const processWalletRefund = async (userId, item, order) => {
    try {
        // Check payment method and order status
        if (order.paymentMethod === 'COD' || order.status === 'Paid') {
            let wallet = await Wallet.findOne({ userId });
            const transactionId = await generateTransactionId();  // Assume this generates a unique ID

            if (!wallet) {
                // Create new wallet for the user if none exists
                wallet = new Wallet({
                    userId,
                    balance: item.price,
                    transactions: [{
                        transactionId,
                        amount: item.price,
                        description: `Refund for returned item: ${item.prodName}`,
                        type: 'Refund',
                        date: new Date(),
                        orderId: order._id
                    }]
                });
                await wallet.save();
            } else {
                // Add refund to existing wallet balance
                wallet.balance += item.price;
                wallet.transactions.push({
                    transactionId,
                    amount: item.price,
                    description: `Refund for returned item: ${item.prodName}`,
                    type: 'Refund',
                    date: new Date(),
                    orderId: order._id
                });
                await wallet.save();
            }

            // Mark the item as refunded to avoid double refunds
            item.isRefunded = true;
            await order.save();

            return { success: true, message: `Refund of ₹${item.price} added to wallet.` };
        } else {
            return { success: false, message: 'Refund cannot be processed. Order is not paid or item is not returned.' };
        }
    } catch (err) {
        console.error('Error processing wallet refund:', err);
        return { success: false, message: 'Error processing wallet refund.' };
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
    loadOrders, updateOrderStatus, getItemsInOrder, updateItemStatus,
    manageReturnRequest
}