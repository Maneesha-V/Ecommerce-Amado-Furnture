const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const mongoDBUrl = process.env.MONGODB_URL;

function connectDB() {
    mongoose.set('strictQuery', true);
   // mongoose.connect(mongoDBUrl, {
     //   useNewUrlParser: true,
       // useUnifiedTopology: true,
       // serverSelectionTimeoutMS: 15000,
   // }, (err) => {
     //   if (err) {
         //   console.log('Error connecting to MongoDB:', err);
       // } else {
        //    console.log('Connected to MongoDB');
       // }
//    });
     try{
         mongoose.connect('mongodb+srv://manudaffodils13:j2oxYij52lPtQQMY@ecomwebapp.tm576.mongodb.net/ecom-furniture?retryWrites=true&w=majority&appName=ecomwebapp',{
             useNewUrlParser:true
         });
        
     } catch (error) {
         return res.status(500).send({status: "error", message: ''+err});
     }
}

module.exports = connectDB;
