require('dotenv').config()
const app = require('./src/app')
const connectDB = require('./src/config/db.config')

app.listen(process.env.PORT, () => {
    connectDB()
    console.log("School backend server is running at PORT", process.env.PORT)
})

app.get('/', (req, res) => {
    res.status(200).json({
        message: "School backend server is running."
    })
})