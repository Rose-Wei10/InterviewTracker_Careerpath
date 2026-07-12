export default function ActivityFeed({
data
}:any){

return(

<div className="card">

<h2>
Recent Activity
</h2>

{

data.map(
(item:any)=>(

<div
key={item._id}
className="activity-item"
>

<strong>

{item.company}

</strong>

<p>

Applied for
{item.position}

</p>

</div>

))

}

</div>

)

}