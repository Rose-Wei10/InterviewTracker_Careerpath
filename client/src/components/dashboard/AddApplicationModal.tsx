import { useState } from "react"
import {
    createApplication,
    type JobApplication
} from "../../services/applicationService"

interface Props {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function AddApplicationModal({
    open,
    onClose,
    onSuccess
}: Props) {

    const [loading, setLoading] = useState(false)

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

    if(!open) return null

    const handleChange = (

        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

    )=>{

        setForm({

            ...form,

            [e.target.name]:e.target.value

        })

    }

    const handleSubmit = async()=>{

        if(form.company==="" || form.role===""){

            alert("Company and Role are required.")

            return

        }

        try{

            setLoading(true)

            await createApplication(form)

            await onSuccess?.();

            onClose()

        }

        catch(err){

            console.log(err)

            alert("Unable to save.")

        }

        finally{

            setLoading(false)

        }

    }

    return(

<div className="modal-overlay">

<div className="application-modal">

<h2>Add Application</h2>

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

loading?

"Saving..."

:

"Save Application"

}

</button>

</div>

</div>

</div>

)

}