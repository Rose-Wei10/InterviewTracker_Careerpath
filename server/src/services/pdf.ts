import { Worker } from "node:worker_threads";
import { HttpError } from "../lib/errors";
// Parse untrusted PDFs outside the API event loop, with a time and heap budget.
export async function extractResumeText(bytes: Uint8Array): Promise<string> {
  if (bytes.length > 5 * 1024 * 1024)
    throw new HttpError(400, "Resume exceeds analysis size limit");
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `const {parentPort,workerData}=require('node:worker_threads');const {PDFParse}=require(workerData.parser);const parser=new PDFParse({data:new Uint8Array(workerData.bytes)});parser.getText({first:20}).then(async r=>{parentPort.postMessage(r.text.slice(0,40000));await parser.destroy();}).catch(()=>process.exit(1));`,
      {
        eval: true,
        workerData: {
          bytes,
          parser: require.resolve("pdf-parse"),
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 16,
        },
      },
    );
    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new HttpError(400, "PDF parsing timed out; use a simpler PDF"));
    }, 10000);
    worker.once("message", (text: string) => {
      clearTimeout(timeout);
      void worker.terminate();
      resolve(text);
    });
    worker.once("error", () => {
      clearTimeout(timeout);
      reject(new HttpError(400, "Unable to extract resume text"));
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new HttpError(400, "Unable to extract resume text"));
      }
    });
  });
}
