const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function connectDB(){
    try{
        mongoose.set('strictQuery', false);
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected to MongoDB Atlas');      
    }catch(error){
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
}
// function connectDB() {
//    mongoose.set('strictQuery', true);
//    mongoose.connect(mongoDBUrl, {
//        useNewUrlParser: true,
//        useUnifiedTopology: true,
//        serverSelectionTimeoutMS: 15000,
//    }, (err) => {
//        if (err) {
//            console.log('Error connecting to MongoDB:', err);
//        } else {
//            console.log('Connected to MongoDB');
//        }
//    });
//      try{
//          mongoose.connect('mongodb+srv://manudaffodils13:j2oxYij52lPtQQMY@ecomwebapp.tm576.mongodb.net/ecom-furniture?retryWrites=true&w=majority&appName=ecomwebapp',{
//              useNewUrlParser:true
//          });

//         console.log('Connected to MongoDB');
        
//      } catch (error) {
//          return res.status(500).send({status: "error", message: ''+error});
//      }
// }

module.exports = connectDB;
