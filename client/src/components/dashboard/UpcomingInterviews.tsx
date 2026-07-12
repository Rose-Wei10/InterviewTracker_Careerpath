export default function UpcomingInterviews(
{data}:any
){

return(

<div className="card">

<h2>
Upcoming Interviews
</h2>

{
data.length===0
?

<p>
No interviews
</p>

:

data.map(
(interview:any)=>(

<div
key={interview._id}
className="interview-item"
>

<h4>
{interview.company}
</h4>

<p>
{new Date(
interview.interviewDate
).toDateString()}
</p>

</div>

))

}

</div>

)

}