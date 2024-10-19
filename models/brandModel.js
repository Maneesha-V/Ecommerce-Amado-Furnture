const mongoose = require("mongoose")
const brandSchema = new mongoose.Schema({
    brand_name : {
        type : String,
        required : true,
        unique : true
    },
    isDelete: { 
        type: Boolean, 
        default: false 
    }
})
module.exports = mongoose.model('Brand',brandSchema)