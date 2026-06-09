const express = require('express')
const cors = require('cors')
const registrationRoutes = require('./features/registration/registration.routes');
const authRoutes = require('./features/auth/auth.routes');
const masterDataRoutes = require('./features/masterData/masterData.routes');
const admissionsRoutes = require('./features/admissions/admissions.routes');


const app = express()

const allowedOrigins = [`${process.env.FRONTEND_URL}`, `${process.env.FRONTEND_URL2}`]

app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (postman/mobile apps)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
app.use(express.json());

app.use('/api/registration', registrationRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/master-data', masterDataRoutes);
app.use('/api/admissions', admissionsRoutes);

module.exports = app;