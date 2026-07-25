//services/dashboardService.ts

import axios from "axios"

export const getDashboard=async()=>{

const res=
await axios.get(
"http://localhost:5001/api/dashboard"
)

return res.data

}