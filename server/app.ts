import { validateEnv } from "./src/config/env";
import { createApp } from "./src/app";

validateEnv();
export default createApp();
