const mongoose = require("mongoose")
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    isDelete : {
        type: Boolean,
        default: false
    }
})
module.exports = mongoose.model('Category',categorySchema)