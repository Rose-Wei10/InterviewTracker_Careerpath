# Careerpath Apply Kit Autofill

1. Open `chrome://extensions` in desktop Chrome, enable **Developer mode**, click **Load unpacked**, and select this folder.
2. In Careerpath, open **Apply Kit** and click **Copy autofill data**. This copies your saved answers, including any personal details you entered. Paste only into the Careerpath extension.
3. Open the employer form, click the extension icon, paste the data, and click **Scan this page**. Review the grouped suggestions, check the fields you want, then click **Fill selected**. For comboboxes, copy an answer and choose the option on the form. For a Greenhouse embed, open the standalone application and scan it again.
4. Review what was filled and submit the application yourself. Open the popup and paste again after moving to a new step if the popup closed.

Matching runs locally. The popup holds the bundle in memory until it closes. The clipboard may still hold the bundle until you copy something else. Only approved values are inserted into the employer page, where the site can read them immediately. The extension skips populated fields, sensitive fields it recognizes, custom controls, and embedded forms. Use Apply Kit's individual Copy buttons for unsupported fields.

**Scan details** reports loaded answers, the page scanned, embedded frames, and the field matches. Use the unfinished-fields checklist for résumé uploads and manual choices. Re-scan after making changes. Apply Kit checks ordinary text after writing it, while custom dropdowns still require choosing and verifying the option on the employer form.

After you see the employer's submission confirmation, open **Record an application after submission** and check the original link. Careerpath searches your records for that exact link before offering an add or edit. A fresh Apply Kit export carries your local Careerpath address if you run it on localhost. Older exports open hosted Careerpath.
