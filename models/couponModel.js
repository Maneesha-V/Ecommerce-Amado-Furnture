const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true 
    }, 
    discountType: { 
        type: String, 
        enum: ['flat', 'percentage'], 
        required: true 
    },  // Type of discount
    discountValue: { 
        type: Number, 
        required: true 
    },  // Flat discount amount or percentage
    minAmount: { 
        type: Number, 
        required: true 
    },  // Minimum amount required to apply the coupon
    maxAmount: {
        type: Number,
        default: 0
    },
    validFrom: { 
        type: Date, 
        required: true 
    },  
    validUntil: { 
        type: Date, 
        required: false 
    },  
    couponLimit: { 
        type: Number, 
        required: false, 
        default: 1 
    },  
    usedBy: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],  
    description: { 
        type: String, 
        required: false 
    },  
    isActive: { 
        type: Boolean, 
        default: true 
    },  // Is coupon active
});

module.exports = mongoose.model('Coupon', couponSchema);
