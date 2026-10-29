import { resetDatabaseFile } from "./client";

resetDatabaseFile();
console.log("Base do Nexo Assist recriada em", process.env.NEXO_DB || "data/nexo.sqlite");
