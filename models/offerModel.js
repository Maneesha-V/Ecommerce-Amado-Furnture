const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    offerName: {
        type: String,
        required: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    applicableTo: {
        type: String,
        enum: ['Product', 'Category', 'All'],
        required: true
    },
    applicableId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'applicableModel', // Refers to 'Product' or 'Category'
        required: function() {
            return this.applicableTo !== 'All'; // applicableId is required only if applicableTo is not 'All'
        }
    },
    applicableModel: {
        type: String,
        enum: ['Product', 'Category'],
        required: function() {
            return this.applicableTo !== 'All'; // applicableModel is required only if applicableTo is not 'All'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Offer', offerSchema);
