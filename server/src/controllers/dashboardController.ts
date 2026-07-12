import { Request, Response } from "express"

export const getDashboardStats = async (
    req: Request,
    res: Response
) => {

    res.json({

        stats:{
            applied:32,
            interview:11,
            offer:2,
            rejected:8
        },

        chartData:[
            {
                month:"Jan",
                count:5
            },
            {
                month:"Feb",
                count:8
            }
        ],

        upcoming:[],

        recent:[]
    })

}