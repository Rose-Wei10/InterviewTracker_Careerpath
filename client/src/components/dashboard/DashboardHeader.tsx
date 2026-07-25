import "./DashboardHeader.css"
import { UserButton } from "@clerk/clerk-react";

export default function DashboardHeader(){

return(

<div className="dashboard-header">

<div>

<h1>
Welcome back, Rose 👋
</h1>

<p>
Track applications and interviews
</p>

</div>

<div className="header-right">

{/* <input
placeholder="Search company..."
className="search"
/> */}
<UserButton afterSignOutUrl="/" />
</div>

</div>

)

}