const express = require('express')
const cors = require('cors')
const registrationRoutes = require('./features/registration/registration.routes');
const authRoutes = require('./features/auth/auth.routes');
const masterDataRoutes = require('./features/masterData/masterData.routes');
const admissionsRoutes = require('./features/admissions/admissions.routes');


const app = express()

app.use(cors({
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true
}));
app.use(express.json());

app.use('/api/registration', registrationRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/master-data', masterDataRoutes);
app.use('/api/admissions', admissionsRoutes);

module.exports = app;