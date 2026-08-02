import { Request, Response } from "express";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

import prisma from "../config/prisma";
import { s3 } from "../config/aws";
import { getAuth } from "@clerk/express";

export const createResume = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, description } = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "Please select a PDF."
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "Resume name is required.",
      });
    }

      const { userId } = getAuth(req);
      console.log("Resume userId:", userId);

      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

    const fileName = `${uuid()}-${req.file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const fileUrl =
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    await prisma.user.upsert({
      where: {
        id: userId,
      },
      update: {},
      create: {
        id: userId,
        email: "",
      },
    });
    
      const resume = await prisma.resume.create({
      data: {
        name,
        description,
        fileUrl,
        fileKey: fileName,
        userId,
      },
    });

    res.status(201).json(resume);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to upload resume."
    });

  }
};

export const getResumes = async (
  req: any,
  res: Response
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const resumes = await prisma.resume.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(resumes);
    console.log("GET /api/resumes");
  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to load resumes.",
    });

  }
};

export const deleteResume = async (
  req: any,
  res: Response
) => {

  try {

    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const resume = await prisma.resume.findFirst({
      where: {
        id: req.params.id,
        userId,
      },
    });

    if (!resume) {
      return res.status(404).json({
        message: "Resume not found.",
      });
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: resume.fileKey,
      })
    );

    await prisma.resume.delete({
      where: {
        id: req.params.id,
      },
    });

    res.json({
      success: true,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Delete failed.",
    });

  }

};