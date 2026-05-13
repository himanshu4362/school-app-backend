const express = require('express')
const cors = require('cors')
const registrationRoutes = require('./features/registration/registration.routes');
const authRoutes = require('./features/auth/auth.routes');

const app = express()

app.use(cors({
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true
}));
app.use(express.json());



app.use('/api/registration', registrationRoutes);
app.use('/api/auth', authRoutes)



module.exports = app;