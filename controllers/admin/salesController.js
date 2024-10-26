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

        // Build filter query
        const today = new Date();
        let filter = {};

        if (filterType === 'daily') {
            // filter.createdAt = { $gte: today.setHours(0, 0, 0, 0), $lte: today };
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
                // filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
            // Find the coupon if the user used it
            const couponUsed = order.couponDiscount > 0 ? 'Yes' : 'No';
            const totalDiscountFromItems = order.items.reduce((sum, item) => {
                return sum + (item.offerDiscount || 0); // Ensure item.offerDiscount is valid
            }, 0);
            const totalDiscount = totalDiscountFromItems + order.couponDiscount;
            return {
                orderId: order.orderNumber,
                date: order.createdAt.toISOString().split('T')[0],
                userName: `${order.user.firstname} ${order.user.lastname}`,
                products: order.items, // Assuming products are stored in 'items' field
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

        // Define the match stage based on filter type
        if (filterType === 'Daily') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            matchStage.createdAt = { $gte: startOfDay, $lte: new Date() };
        } else if (filterType === 'Weekly') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay()); // Set to the start of the week (Sunday)
            matchStage.createdAt = { $gte: startOfWeek, $lte: new Date() };
        } else if (filterType === 'Monthly') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
        } else if (filterType === 'Yearly') {
            const startOfYear = new Date(today.getFullYear(), 0, 1); // Start of the year
            const endOfYear = new Date(today.getFullYear() + 1, 0, 0); // End of the year (Dec 31)            
            // Update matchStage for yearly filter
            matchStage.createdAt = { $gte: startOfYear, $lt: endOfYear };
        } else if (filterType === 'custom') {
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0); // Start of the custom date range
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of the custom date range

                matchStage.createdAt = { $gte: start, $lte: end }; // Custom range

                console.log("Custom Filter Match Stage:", matchStage);
            }
        }

        console.log("Match Stage:", matchStage);

        // Use aggregation to get sales data based on the filter type
        let salesData;

        if (filterType === 'Daily') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group by date
                        totalAmount: { $sum: "$totalAmount" }, // Sum total amounts for each day
                        totalOrders: { $sum: 1 } // Count total orders for each day
                    }
                },
                { $sort: { _id: 1 } } // Sort by date
            ]);
        } else if (filterType === 'Weekly') {
            salesData = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group by each day in the week
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
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group by each day in the month
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
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, // Group by month in the year
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
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // Group by date
                        totalAmount: { $sum: "$totalAmount" }, // Sum total amounts for each day
                        totalOrders: { $sum: 1 } // Count total orders for each day
                    }
                },
                { $sort: { _id: 1 } } // Sort by date
            ]);
        }

        console.log("Sales Data:", salesData);

        // Top-selling products
        const topSellingProducts = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.prodName", // Group by product name
                    totalSales: { $sum: "$items.quantity" }, // Sum up the quantity sold
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } // Total revenue
                }
            },
            { $sort: { totalSales: -1 } }, // Sort by total sales in descending order
            { $limit: 2 }, // Get top 2 selling products
            {
                $project: {
                    _id: 1,
                    totalSales: 1,
                    totalRevenue: 1,
                    productName: "$_id" // Use product name as the name
                }
            }
        ]);
        console.log("topSellingProducts Data:", topSellingProducts);
        // Top-selling categories aggregation
        const topSellingCategories = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'products', // Assuming 'products' collection contains product data
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: "$productDetails" }, // Unwind the product details to access the category
            {
                $lookup: {
                    from: 'categories', // Assuming 'categories' collection contains category data
                    localField: 'productDetails.categoryId', // This should be the field in productDetails that contains category ID
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: "$categoryDetails" }, // Unwind the category details to access the category name
            {
                $group: {
                    _id: "$categoryDetails.name", // Group by category name instead of ID
                    totalSales: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { totalSales: -1 } }, // Sort by total sales in descending order
            { $limit: 2 } // Limit to top 3 categories
        ]);
        console.log("topSellingCategories Data:", topSellingCategories);
        // Top-selling brands aggregation
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
        // Send response with sales data
        res.json({
            filterType,
            salesData, // Send the aggregated sales data
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