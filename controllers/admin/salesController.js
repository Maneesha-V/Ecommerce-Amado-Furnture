const Order = require("../../models/orderModel")
const Coupon = require("../../models/couponModel")
const { ObjectId } = require('mongodb')

//dashboard
const loadDashboard = async (req, res) => {
    try {
        adminId = req.session.adminId
        isAdmin = req.session.isAdmin
        res.render('dashboard')
    }
    catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
}
const loadSales = async (req, res) => {
    try {
        const orders = await Order.find({})
        // console.log("orders",orders);
        const { totalOrders, totalAmount, totalDiscount } = orders.reduce((acc, order) => {
            console.log("order.items", order.items);

            acc.totalOrders += 1;
            acc.totalAmount += order.totalAmount;
            acc.totalDiscount += order.couponDiscount || 0;
            const totalOfferDisc = order.items.reduce((itemAcc, item) => {
                return itemAcc + (item.offerDiscount || 0);
            }, 0);

            acc.totalDiscount += totalOfferDisc;

            return acc;
        }, { totalOrders: 0, totalAmount: 0, totalDiscount: 0 });
        res.render('viewSales', { totalOrders, totalAmount, totalDiscount })
    } catch (err) {
        console.log("err", err);
        res.status(500).send('Error loading sales data');
    }
}

const getSalesReport = async (req, res) => {
    try {
        console.log("body", req.body);
        const { filterType, startDate, endDate } = req.body;
        let orders = [];

        const today = new Date();
        let filter = {};

        if (filterType === 'daily') {
            const startOfDay = new Date(today.setHours(0, 0, 0, 0)); 
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
        } else if (filterType === 'weekly') {
            const oneWeekAgo = new Date(today);
            oneWeekAgo.setDate(today.getDate() - 7);
            filter.createdAt = { $gte: oneWeekAgo, $lte: today };
        } else if (filterType === 'monthly') {
            const oneMonthAgo = new Date(today);
            oneMonthAgo.setMonth(today.getMonth() - 1);
            filter.createdAt = { $gte: oneMonthAgo, $lte: today };
        } else if (filterType === 'yearly') {
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            filter.createdAt = { $gte: oneYearAgo, $lte: today };
        } else if (filterType === 'custom') {
            if (startDate && endDate) {
                const start = new Date(startDate); 
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); 

                filter.createdAt = { $gte: start, $lte: end };
            }
        }
        console.log("filter", filter);
        orders = await Order.find(filter).populate('user').exec();
        console.log("orders", orders);

        const coupons = await Coupon.find().exec();
        console.log("coupons", coupons);

        const result = orders.map(order => {
            const couponUsed = order.couponDiscount > 0 ? 'Yes' : 'No';
            const totalDiscountFromItems = order.items.reduce((sum, item) => {
                return sum + (item.offerDiscount || 0); 
            }, 0);
            const totalDiscount = totalDiscountFromItems + order.couponDiscount;
            return {
                orderId: order.orderNumber,
                date: order.createdAt.toLocaleDateString('en-GB').replace(/\//g, '-'),
                userName: `${order.user.firstname} ${order.user.lastname}`,
                products: order.items, 
                totalAmount: order.totalAmount,
                discount: totalDiscount,
                coupon: couponUsed,
                paymentMethod: order.paymentMethod,
                orderStatus: order.status
            }

        });
        res.json(result);

    }
    catch (err) {
        console.log("err", err);
        res.status(500).json({ error: 'Failed to fetch sales report' });
    }
}

const getFilteredSales = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.body;
        const today = new Date();
        let matchStage = {};

        if (filterType === 'Daily') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            matchStage.createdAt = { $gte: startOfDay, $lte: new Date() };
        } else if (filterType === 'Weekly') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay()); 
            matchStage.createdAt = { $gte: startOfWeek, $lte: new Date() };
        } else if (filterType === 'Monthly') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
        } else if (filterType === 'Yearly') {
            const startOfYear = new Date(today.getFullYear(), 0, 1); 
            const endOfYear = new Date(today.getFullYear() + 1, 0, 0);            
            matchStage.createdAt = { $gte: startOfYear, $lt: endOfYear };
        } else if (filterType === 'custom') {
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0); 
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); 

                matchStage.createdAt = { $gte: start, $lte: end }; 

                console.log("Custom Filter Match Stage:", matchStage);
            }
        }

        console.log("Match Stage:", matchStage);

        let salesData;

        if (filterType === 'Daily') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                        totalAmount: { $sum: "$totalAmount" }, 
                        totalOrders: { $sum: 1 } 
                    }
                },
                { $sort: { _id: 1 } } 
            ]);
        } else if (filterType === 'Weekly') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                        totalAmount: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        } else if (filterType === 'Monthly') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                        totalAmount: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        } else if (filterType === 'Yearly') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        totalAmount: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        } else if (filterType === 'custom') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                        totalAmount: { $sum: "$totalAmount" }, 
                        totalOrders: { $sum: 1 } 
                    }
                },
                { $sort: { _id: 1 } } 
            ]);
        }

        console.log("Sales Data:", salesData);

        const topSellingProducts = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.prodName", 
                    totalSales: { $sum: "$items.quantity" }, 
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } 
                }
            },
            { $sort: { totalSales: -1 } }, 
            { $limit: 2 }, 
            {
                $project: {
                    _id: 1,
                    totalSales: 1,
                    totalRevenue: 1,
                    productName: "$_id" 
                }
            }
        ]);
        console.log("topSellingProducts Data:", topSellingProducts);

        const topSellingCategories = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'products', 
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: "$productDetails" }, 
            {
                $lookup: {
                    from: 'categories', 
                    localField: 'productDetails.categoryId', 
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails.name", 
                    totalSales: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { totalSales: -1 } }, 
            { $limit: 2 } 
        ]);
        console.log("topSellingCategories Data:", topSellingCategories);

        const topSellingBrands = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: 'brands',
                    localField: 'productDetails.brand',
                    foreignField: '_id',
                    as: 'brandDetails'
                }
            },
            { $unwind: "$brandDetails" },
            {
                $group: {
                    _id: "$brandDetails.brand_name",
                    totalSales: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 2 }
        ])
        console.log("topSellingBrands Data:", topSellingBrands);

        res.json({
            filterType,
            salesData, 
            topSellingProducts,
            topSellingCategories,
            topSellingBrands
        });

    } catch (err) {
        console.error('Error fetching filtered sales data:', err);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
};

module.exports = { getSalesReport, loadDashboard, loadSales, getFilteredSales }