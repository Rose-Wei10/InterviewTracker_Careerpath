import axios from "axios";

const API = "http://localhost:5001/api/dashboard";

export async function getDashboard(token: string) {

    const res = await axios.get(API,{

        headers:{
            Authorization:`Bearer ${token}`
        }

    });

    return res.data;
}