import dotenv from "dotenv";
import path from "path";
import { createServer } from "./server";

// FORCE dotenv to load from backend/.env
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});


const port = Number(process.env.PORT || 3000);

const app = createServer();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
