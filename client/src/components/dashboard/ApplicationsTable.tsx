export default function ApplicationsTable({
applications
}:any){

return(

<div className="card">

<h2>
Recent Applications
</h2>

<table>

<thead>

<tr>

<th>Company</th>
<th>Position</th>
<th>Status</th>

</tr>

</thead>

<tbody>

{
applications.map(
(app:any)=>(

<tr key={app._id}>

<td>
{app.company}
</td>

<td>
{app.position}
</td>

<td>
<span className=
{app.status.toLowerCase()}
>

{app.status}

</span>

</td>

</tr>

))
}

</tbody>

</table>

</div>

)

}