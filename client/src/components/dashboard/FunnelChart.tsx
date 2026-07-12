import{

ResponsiveContainer,
AreaChart,
Area,
XAxis,
Tooltip

}
from"recharts"

export default function FunnelChart(
{data}:any
){

return(

<div className="card">

<h2>
Applications Trend
</h2>

<ResponsiveContainer
width="100%"
height={300}
>

<AreaChart data={data}>

<XAxis dataKey="month"/>

<Tooltip/>

<Area
dataKey="count"
/>

</AreaChart>

</ResponsiveContainer>

</div>

)

}