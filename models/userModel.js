const mongoose = require("mongoose")
const addressSchema = require("../models/addressModel")
const userSchema = new mongoose.Schema({
    firstname : {
        type : String,
        required : true
    },
    lastname : {
        type : String,
        required : true
    },
    mobile : {
        type : Number,
        unique : true,
        required : false,
        sparse : true,   //to get phone num null
        default : null
    },
    googleId : {
        type : String,
        unique : true,
        sparse: true // Allows multiple null values, for users without Google auth
    },
    email : {
        type : String,
        unique : true,
        required : true
    },
    password : {
        type : String,
        required : false
    },
    is_admin : {
        type : Boolean,
        default : false
    },
    is_block : {
        type : Boolean,
        default : false
    },
    addresses : [addressSchema],
    defaultAddress : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Address'
    },
    cart : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Cart'
    }
})
module.exports = mongoose.model('User',userSchema)