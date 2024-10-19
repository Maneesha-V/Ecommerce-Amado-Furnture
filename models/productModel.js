const mongoose = require("mongoose")
const productSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    // category : {
    //     type : String,
    //     required : true
    // },
    subcategory : {
        type : String,
        required : false
    },
    brand : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        default: null
    },
    description : {
        type : String,
        required : true

    },
    price : {
        type : Number,
        required : true
    },
    offerDiscountedPrice: { type: Number, default: null },  
    activeOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null }, 
    stock : {
        type : Number,
        required : true
    },
    prodImages : [{
        type : String,
        required : true
    }],
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    is_block : {
        type : Boolean,
        default : false
    },
    popularity : Number,
    averageRating : Number,
    featured : Boolean,
    createdAt : { 
        type: Date, 
        default: Date.now 
    }
})
module.exports = mongoose.model('Product',productSchema)