import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"

import applicationRoutes
from "./routes/applicationRoutes"

import dashboardRoutes
from "./routes/dashboard"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get(
"/",
(req,res)=>{

res.json({
message:
"Interview Tracker API Running"
})

}
)

app.use(
"/api/applications",
applicationRoutes
)

app.use(
"/api/dashboard",
dashboardRoutes
)

const PORT =
process.env.PORT || 5000

mongoose.connect(
process.env.MONGO_URI as string
)
.then(()=>{

console.log(
"Mongo connected"
)

app.listen(
PORT,
()=>{

console.log(
`Server running on ${PORT}`
)

}
)

})
.catch(console.error)