const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const stockRoutes = require('./routes/stockRoutes');
const salesRoutes = require('./routes/salesRoutes');
const dealerRoutes = require('./routes/dealerRoutes');
const lineStockRoutes = require('./routes/lineStockRoutes');
const billingRoutes = require('./routes/billingRoutes');
const chitFundRoutes = require('./routes/chitFundRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const businessRoutes = require('./routes/businessRoutes');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

app.use(helmet());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'https://sri-vaishnavi-jewellers.vercel.app', // Example domain, user should update FRONTEND_URL
            'https://sri-vaishnavi-jewellers-frontend.vercel.app'
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/line-stock', lineStockRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/chit-funds', chitFundRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/business', businessRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
