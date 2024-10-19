require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const session = require("express-session")
const path = require("path")
const multer = require('multer');
// const flash = require('connect-flash');
const upload = multer();
const authController = require("../controllers/admin/authController")
const productController = require("../controllers/admin/productController")
const categoryController = require("../controllers/admin/categoryController")
const customerController = require("../controllers/admin/customerController")
const brandController = require("../controllers/admin/brandController")
const ordersController = require("../controllers/admin/ordersController")
const couponController = require("../controllers/admin/couponController")
const offerController = require("../controllers/admin/offerController")
const salesController = require("../controllers/admin/salesController")
// const config = require("../config/config")
const imgUpload = require('../middleware/multer')
const { isLogin, isLogout } = require("../middleware/adminAuth")
const admin_route = express()

admin_route.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))
// admin_route.use(bodyParser.json())
// admin_route.use(bodyParser.urlencoded({ extended: true }))

// admin_route.use(express.static(path.join(__dirname,'../public/adminStyle/assets')))
// admin_route.use(flash());
// admin_route.use((req, res, next) => {
//     res.locals.successMessage = req.flash('success');
//     res.locals.errorMessage = req.flash('error');
//     next();
// });

// admin_route.set('view engine', 'ejs')
admin_route.set('views', './views/admin')

admin_route.get('/login', isLogout, authController.loadLogin)
admin_route.post('/login', isLogout, authController.loginAdmin)
admin_route.get('/dashboard', isLogin, salesController.loadDashboard)
admin_route.get('/viewSales', isLogin, salesController.loadSales)
admin_route.post('/sales-report', isLogin, salesController.getSalesReport)
admin_route.post('/filterSales', isLogin, salesController.getFilteredSales)
admin_route.get('/products', isLogin, productController.loadProducts)
admin_route.get('/customers', isLogin, customerController.loadCustomers)
admin_route.post('/hide-customer/:id', customerController.blockCustomer)
admin_route.get('/add-product', isLogin, productController.getAddProduct)
admin_route.post('/add-product', imgUpload.array('prodImages', 3), productController.insertProduct)
admin_route.get('/edit-product/:id', isLogin, productController.getEditProduct)
admin_route.post('/edit-product/:id', imgUpload.array('prodImages', 3), productController.updateProduct)
admin_route.post('/hide-product/:id', productController.hideProduct)
// admin_route.post('/delete-product/:id',adminController.deleteProduct)
admin_route.delete('/delete-image/:prodId', productController.deleteImage)
admin_route.get('/category', isLogin, categoryController.getAddCategory)
admin_route.post('/add-category', categoryController.addCategory)
admin_route.post('/edit-category/:id', categoryController.updateCategory)
admin_route.post('/delete-category/:id', categoryController.deleteCategory)
admin_route.post('/add-brand', brandController.addBrand)
admin_route.get('/orders', isLogin, ordersController.loadOrders)
// admin_route.post('/orders/:orderId/status',ordersController.updateOrderStatus)
admin_route.patch('/orders/:orderId/status', ordersController.updateOrderStatus)
admin_route.get('/items-status/:orderId', isLogin, ordersController.getItemsInOrder)
admin_route.post('/items-status/:orderId/:itemId/status', upload.none(), ordersController.updateItemStatus)
admin_route.post('/items-status/:orderId/:itemId/return', upload.none(), ordersController.manageReturnRequest)
admin_route.get('/coupons', isLogin, couponController.loadCoupon)
admin_route.get('/add-coupon', isLogin, couponController.getAddCoupon)
admin_route.post('/add-coupon', couponController.createCoupon)
admin_route.post('/hide-coupon/:couponId', couponController.hideCoupon)
admin_route.get('/offers', isLogin, offerController.loadOffer)
admin_route.get('/add-offer', isLogin, offerController.getAddOffer)
admin_route.post('/add-offer', offerController.createOffer)
admin_route.get('/edit-offer/:offerId', isLogin, offerController.getEditOffer)
admin_route.post('/edit-offer/:offerId', offerController.updateOffer)
admin_route.post('/hide-offer/:offerId', offerController.hideOffer)
admin_route.get('/logout', isLogin, authController.loadLogout)
admin_route.post('/logout', isLogin, authController.exitLogout)

module.exports = admin_route