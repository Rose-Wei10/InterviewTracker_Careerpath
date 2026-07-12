import {
useEffect,
useState
} from "react"

import DashboardHeader
from "../components/dashboard/DashboardHeader"

import StatCards
from "../components/dashboard/StatCards"

import ApplicationsTable
from "../components/dashboard/ApplicationsTable"

import FunnelChart
from "../components/dashboard/FunnelChart"

import UpcomingInterviews
from "../components/dashboard/UpcomingInterviews"

import ActivityFeed
from "../components/dashboard/ActivityFeed"

import {getDashboard}
from "../services/dashboardService"

import "../styles/dashboard.css"

export default function Dashboard(){

    const[data,setData]=
        useState<any>(null)

        useEffect(()=>{

        load()

    },[])

    const load=async()=>{

        try{

        const res=
        await getDashboard()

        setData(res)

        }catch(err){

        console.log(err)

        }

    }

    if(!data){

    return(

    <div
    style={{
    padding:"50px"
    }}
    >

    Loading Dashboard...

    </div>

    )

    }

    return(

    <div className="dashboard">

    <DashboardHeader/>

    <StatCards
    stats={data.stats}
    />

    <div className="dashboard-grid">

    <div>

    <FunnelChart
    data={data.chartData}
    />

    <ApplicationsTable
    applications={data.recent}
    />

    </div>

    <div>

    <UpcomingInterviews
    data={data.upcoming}
    />

    <ActivityFeed
    data={data.recent}
    />

    </div>

    </div>

    </div>

    )

}