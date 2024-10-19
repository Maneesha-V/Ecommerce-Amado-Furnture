const express = require("express")
const path = require("path")
const nocache = require("nocache")
const bodyParser = require("body-parser")
// const mongoose = require("mongoose")
const dotenv = require("dotenv");
const methodOverride = require('method-override');
dotenv.config();
// Import the DB connection logic
const connectDB = require("./config/db")
//admin Route
const adminRoute = require("./routes/adminRoute")
//user Route
const userRoute = require("./routes/userRoute")
const app = express()

const port = process.env.PORT || 3000;
// Connect to MongoDB
connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.static(path.join(__dirname, 'public')))
// Global Middleware (applies to all routes)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(nocache())
app.use(methodOverride('_method'));
// Route-specific middleware and routing
app.use('/admin', adminRoute)
app.use('/', userRoute)
// app.use('/',adminRoute,isLogin)

// 404 Error Handling Middleware
app.use((req, res, next) => {
    res.status(404).render(req.originalUrl.startsWith('/admin') ? 'admin/404' : 'users/404', {
        status: 404,
        message: "The page you are looking for does not exist."
    })
});

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.status || 500;
    const isAdminRoute = req.originalUrl.startsWith('/admin');

    if (statusCode === 500) {
        res.status(500).render(isAdminRoute ? 'admin/500' : 'users/500', {
            status: 500,
            message: "An internal server error occurred."
        });
    } else {
        res.status(statusCode).render(isAdminRoute ? 'admin/error' : 'users/error', {
            status: statusCode,
            message: err.message || "An error occurred."
        });
    }
});

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
})