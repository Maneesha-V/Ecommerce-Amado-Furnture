const mongoose = require("mongoose")
const addressSchema = new mongoose.Schema({
    name : {
        type :String
    },
    addressLine1 : {
        type : String
    },
    addressLine2 : {
        type : String
    },
    mobile : {
        type : Number
    },
    city : {
        type : String
    },
    state : {
        type : String
    },
    district : {
        type : String
    },
    zip : {
        type : Number
    },
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        default : null
    }
})
module.exports = addressSchema
// module.exports = mongoose.model('Address',addressSchema)