import axios from "axios";

const API = "http://localhost:5001/api/applications";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
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

export interface JobApplication {
  id?: string;

  company: string;

  role: string;

  location?: string;

  salary?: string;

  appliedDate: string;

  status:
    | "Applied"
    | "OA"
    | "Interview"
    | "Final Round"
    | "Offer"
    | "Reject"
    | "Ghosted";

  jobLink?: string;

  notes?: string;

  createdAt?: string;

  updatedAt?: string;
}


// Get all applications
export async function getApplications(): Promise<JobApplication[]> {
  const res = await api.get("/");
  return res.data;
}

// Get one application
export async function getApplication(id: string) {
  const res = await api.get(`/${id}`);
  return res.data;
}

// Create
export async function createApplication(application: JobApplication) {
  const res = await api.post("/", application);
  return res.data;
}

// Update
export async function updateApplication(
  id: string,
  application: Partial<JobApplication>
) {
  const res = await api.put(`/${id}`, application);
  return res.data;
}

// Delete
export async function deleteApplication(id: string) {
  const res = await api.delete(`/${id}`);
  return res.data;
}

// Update status only
export async function updateStatus(
  id: string,
  status: JobApplication["status"]
) {
  const res = await api.put(`/${id}`, {
    status,
  });

  return res.data;
}