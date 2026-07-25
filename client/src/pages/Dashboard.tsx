import {useEffect, useState} from "react"
import DashboardHeader from "../components/dashboard/DashboardHeader"
import StatCards from "../components/dashboard/StatCards"
import ApplicationsTable from "../components/dashboard/ApplicationsTable"
import FunnelChart from "../components/dashboard/FunnelChart"
import UpcomingInterviews from "../components/dashboard/UpcomingInterviews"
import ActivityFeed from "../components/dashboard/ActivityFeed"
import {getDashboard} from "../services/dashboardService"
import "../styles/dashboard.css"
import type { JobApplication } from "../services/applicationService"
import {
    deleteApplication,
    getApplications,
    updateApplication,
    createApplication,
    updateStatus,
}
from "../services/applicationService"
import { UserButton } from "@clerk/clerk-react";
import AddApplicationModal from "../components/dashboard/AddApplicationModal"
import { useAuth } from "@clerk/clerk-react";
import { setAuthToken } from "../services/applicationService";

export default function Dashboard(){

    const[data,setData]=
        useState<any>(null)

    //     useEffect(()=>{
    //         loadApplications()

    //     load()

    // },[])
    const { getToken } = useAuth();
    const [showAddModal, setShowAddModal] = useState(false)

    const [applications, setApplications] =
        useState<JobApplication[]>([])

    const load = async () => {
    try {
        console.log("Calling getDashboard...");

        const res = await getDashboard();

        console.log("Dashboard response:", res);

        setData(res);
    } catch (err) {
        console.error("Dashboard error:", err);
    }
    };


    const loadApplications = async () => {
        try {
            const data = await getApplications();
            console.log("Applications:", data);
            setApplications(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
    async function initialize() {
        console.log("1. Getting token");

        const token = await getToken();

        console.log("2. Token:", token);

        setAuthToken(token);

        console.log("3. Loading applications");

        await loadApplications();

        console.log("4. Loading dashboard");

        await load();

        console.log("5. Finished");
    }

    initialize();
    }, []);
    

    // useEffect(() => {
    // async function setup() {
    //     const token = await getToken();
    //     setAuthToken(token);
    // }

    // setup();
    
    // }, []);

    useEffect(() => {
        async function initialize() {
            const token = await getToken();

            setAuthToken(token);

            await loadApplications();

            await load();
        }

        initialize();
    }, []);


    const handleDelete = async (id: string) => {

        await deleteApplication(id)

        loadApplications()

    }

    const handleStatusChange = async (

        id: string,

        status: string

        ) => {

            await updateStatus(id, status as JobApplication["status"])

            loadApplications()

    }

    // const handleEdit = (

    //     application: JobApplication

    //     ) => {

    //         setSelectedApplication(application)
    //         setEditModalOpen(true)

    // }
    const handleEdit = (
        application: JobApplication
        ) => {

            console.log("Edit:", application)

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

            <ApplicationsTable
                applications={applications}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onAdd={() => setShowAddModal(true)}
            />

        <div className="dashboard-grid">

            <div>

                <FunnelChart
                data={data.chartData}
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
            <AddApplicationModal

                open={showAddModal}

                onClose={()=>setShowAddModal(false)}

                onSuccess={loadApplications}

            />
        </div>

    )

}