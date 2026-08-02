import { useEffect, useState } from "react"
import {
    createApplication,
    updateApplication,
    uploadResume,
    type JobApplication
} from "../../services/applicationService"

interface Props {
    open: boolean
    application?: JobApplication | null
    onClose: () => void
    onSuccess: () => void
}

export default function AddApplicationModal({
    open,
    application,
    onClose,
    onSuccess
}: Props) {

    const [loading, setLoading] = useState(false)
    // const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [form, setForm] = useState<JobApplication>({
        company: "",
        role: "",
        location: "",
        salary: "",
        appliedDate: new Date().toISOString().slice(0,10),
        status: "Applied",
        jobLink: "",
        notes: ""
    });


    // const handleFileChange = (
    //     e: React.ChangeEvent<HTMLInputElement>
    // ) => {
    //     if (e.target.files && e.target.files.length > 0) {
    //         setResumeFile(e.target.files[0]);
    //     }
    // };

    const handleChange = (

        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

    )=>{

        setForm({

            ...form,

            [e.target.name]:e.target.value

        })

    }

    useEffect(() => {

    if (application) {

        setForm({

            company: application.company,

            role: application.role,

            location: application.location ?? "",

            salary: application.salary ?? "",

            appliedDate:
                application.appliedDate
                    ? application.appliedDate.slice(0, 10)
                    : new Date().toISOString().slice(0, 10),

            status: application.status,

            jobLink: application.jobLink ?? "",

            notes: application.notes ?? "",

        })

    } else {

        setForm({

            company: "",

            role: "",

            location: "",

            salary: "",

            appliedDate: new Date().toISOString().slice(0,10),

            status: "Applied",

            jobLink: "",

            notes: "",

        })

    }

}, [application, open])

const handleSubmit = async () => {
    const payload = {
        ...form,
        appliedDate: new Date(form.appliedDate).toISOString(),
    };

    if (!form.company || !form.role) {

        alert("Company and Role are required.");

        return;

    }

    try {

        setLoading(true);

        if (application) {

            await updateApplication(
                application.id!,
                payload
            );

        } else {

            await createApplication(payload);

        }

        await onSuccess();

        onClose();

    } catch (err) {

        console.error(err);

        alert("Unable to save.");

    } finally {

        setLoading(false);

    }

};
if (!open) return null;
    return(

<div className="modal-overlay">

<div className="application-modal">

<h2>
    {application ? "Edit Application" : "Add Application"}
</h2>

<div className="form-grid">

<div>

<label>Company *</label>

<input

name="company"

value={form.company}

onChange={handleChange}

/>

</div>

<div>

<label>Role *</label>

<input

name="role"

value={form.role}

onChange={handleChange}

/>

</div>

<div>

<label>Location</label>

<input

name="location"

value={form.location}

onChange={handleChange}

/>

</div>

<div>

<label>Salary</label>

<input

name="salary"

value={form.salary}

onChange={handleChange}

/>

</div>

<div>

<label>Application Date</label>

<input

type="date"

name="appliedDate"

value={form.appliedDate}

onChange={handleChange}

/>

</div>

<div>

<label>Status</label>

<select

name="status"

value={form.status}

onChange={handleChange}

>

<option>Applied</option>

<option>OA</option>

<option>Interview</option>

<option>Final Round</option>

<option>Offer</option>

<option>Reject</option>

<option>Ghosted</option>

</select>

</div>

<div className="full-width">

<label>Job Link</label>

<input

name="jobLink"

value={form.jobLink}

onChange={handleChange}

/>

</div>

{/* <div className="full-width">

    <label>Resume (PDF)</label>

    <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
    />

    {resumeFile && (
        <p style={{ marginTop: "6px", fontSize: "14px" }}>
            Selected: {resumeFile.name}
        </p>
    )}

</div> */}



<div className="full-width">

<label>Notes</label>

<textarea

rows={5}

name="notes"

value={form.notes}

onChange={handleChange}

/>

</div>

</div>

<div className="modal-buttons">

<button
    type="button"
    className="cancel-btn"
    onClick={onClose}
    >

Cancel

</button>

<button

className="save-btn"

onClick={handleSubmit}

disabled={loading}

>

{
loading
?
"Saving..."
:
application
    ? "Update Application"
    : "Save Application"
}

</button>

</div>

</div>

</div>

)

}