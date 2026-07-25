import prisma from "../config/prisma";
import { getAuth } from "@clerk/express";

export const getDashboardStats = async (req: any, res: any) => {

    const { userId } = getAuth(req);

    if (!userId) {
        return res.status(401).json({
            message: "Unauthorized",
        });
    }

    const applications =
        await prisma.jobApplication.findMany({

            where: {
                userId,
            },

            orderBy: {
                appliedDate: "desc",
            },

        });

    const stats = {

        applied:
            applications.filter(a => a.status === "Applied").length,

        oa:
            applications.filter(a => a.status === "OA").length,

        interview:
            applications.filter(a => a.status === "Interview").length,

        offer:
            applications.filter(a => a.status === "Offer").length,

        rejected:
            applications.filter(a => a.status === "Reject").length,

        ghosted:
            applications.filter(a => a.status === "Ghosted").length,

    };

    res.json({

        stats,

        recent:
            applications
                .sort(
                    (a,b)=>
                    b.createdAt.getTime()-
                    a.createdAt.getTime()
                )
                .slice(0,5),

        upcoming: [],

        chartData: [],

    });

};