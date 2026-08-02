import axios from "axios";

const API = "http://localhost:5001/api/resumes";

let authToken: string | null = null;

export function setResumeAuthToken(token: string | null) {
  authToken = token;
}

const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

export interface Resume {
    id: string;
    name: string;
    description?: string;

    fileKey: string;
    fileUrl: string;

    createdAt: string;
}

export async function getResumes(): Promise<Resume[]> {
  const res = await api.get("/");
  return res.data;
}

export async function uploadResume(
  file: File,
  name: string,
  description: string
) {
  const formData = new FormData();

  formData.append("resume", file);
  formData.append("name", name);
  formData.append("description", description);

  const res = await api.post("/", formData);

  return res.data;
}

export async function deleteResume(id: string) {
  const res = await api.delete(`/${id}`);

  return res.data;
}