const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const mongoDBUrl = process.env.MONGODB_URL;

function connectDB() {
    mongoose.set('strictQuery', true);
    mongoose.connect(mongoDBUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 15000,
    }, (err) => {
        if (err) {
            console.log('Error connecting to MongoDB:', err);
        } else {
            console.log('Connected to MongoDB');
        }
    });
}

module.exports = connectDB;
