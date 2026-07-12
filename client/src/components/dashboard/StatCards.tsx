import {
Briefcase,
Calendar,
CheckCircle,
XCircle
}
from "lucide-react"

export default function StatCards({stats}:any){

const cards=[

{
title:"Applied",
count:stats.applied,
icon:<Briefcase/>
},

{
title:"Interview",
count:stats.interview,
icon:<Calendar/>
},

{
title:"Offer",
count:stats.offer,
icon:<CheckCircle/>
},

{
title:"Rejected",
count:stats.rejected,
icon:<XCircle/>
}

]

return(

<div className="stats">

{
cards.map(card=>(

<div
className="stat-card"
key={card.title}
>

<div>

<h3>
{card.count}
</h3>

<p>
{card.title}
</p>

</div>

{card.icon}

</div>

))
}

</div>

)

}