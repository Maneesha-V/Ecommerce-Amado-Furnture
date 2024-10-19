const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    prodName: {
        type: String,
        required: true
    },
    prodImage: {
        type: String, // URL or path to the product image
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    itemStatus: {
        type: String,
        default: 'Pending'
    },
    isRefunded : {
        type: Boolean,
        default: false 
    },
    reason: { 
        type: String, 
        default: '' 
    },
    returnStatus: {
        type: String,
        enum: ['None', 'Pending', 'Approved', 'Rejected'], // Enumerate possible states
        default: 'None' // Default to 'None' indicating no return request made
    },
    offerDiscount: {
        type: Number,
        default: 0
    }
});

const orderSchema = new Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentMethod: {
        type: String,
        required: true
    },
    razorpayOrderId: {
        type: String,
    },
    razorpay_payment_id: {
        type: String
    },
    razorpay_signature: {
        type: String
    },
    status: {
        type: String,
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    canceledAt: { 
        type: Date 
    }, 
    statusUpdatedAt: { 
        type: Date 
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    couponCode: { 
        type: String, 
        required: false
    }
});

module.exports = mongoose.model('Order', orderSchema);
