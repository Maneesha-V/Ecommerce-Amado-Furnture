const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const walletSchema = new Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    balance: { 
        type: Number, 
        default: 0 
    },
    transactions: [
        {
            transactionId: {
                type: String,
                required: true,
                unique: true
            },
            amount: { 
                type: Number, 
                required: true 
            },
            type:{
                type: String, 
                enum: ['Refund', 'Canceled', 'Debit','Credit'], // Different types of cash
                default: 'Refund'  
            },
            description: { 
                type: String, 
                required: true 
            },
            date: { 
                type: Date, 
                default: Date.now 
            },
            orderId: {  // Only added for canceled transactions
                type: Schema.Types.ObjectId, 
                ref: 'Order',
                required: function() {
                    return this.type === 'Canceled';  // Required only for Canceled transactions
                }
            }
        }
    ]
});

module.exports = mongoose.model('Wallet', walletSchema);

