import prisma from "../config/prisma"

export const getDashboardStats = async (
req,
res
)=>{

const applications=

    await prisma.jobApplication.findMany()

const stats={

    applied:

    applications.filter(

    a=>a.status==="Applied"

    ).length,

    oa:

    applications.filter(

    a=>a.status==="OA"

    ).length,

    interview:

    applications.filter(

    a=>a.status==="Interview"

    ).length,

    offer:

    applications.filter(

    a=>a.status==="Offer"

    ).length,

    rejected:

    applications.filter(

    a=>a.status==="Reject"

    ).length,

    ghosted:

    applications.filter(

    a=>a.status==="Ghosted"

    ).length

}

res.json({

    stats,

    recent:applications,

    upcoming:[],

    chartData:[]

    })

}