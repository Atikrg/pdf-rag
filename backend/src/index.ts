import express from "express";
import { PrismaClient } from "../generated/prisma/client";
import { qdrant_client } from "./lib/qdrant";
import uploadRoutes from "./routes/uploadRoutes";
import ragRoutes from "./routes/ragRoutes";
import chatRoutes from "./routes/chatRoutes";
import metaRoutes from "./routes/meta.routes";
import { connectRedis } from "./lib/redis.lib";
import minioService from "./lib/minIO.lib";

const app = express();

app.use(express.json());

app.use("/api", uploadRoutes);
app.use("/api", ragRoutes);
app.use("/api", chatRoutes);
app.use("/api", metaRoutes);

console.log("hello");


(async () => {
  try {
    const connected = await minioService.ensureConnection();

    if (!connected) {
      process.exit(1);
    }


    console.log("MINIO connected");
  } catch (error: any) {
    console.error("Unable to connect to MINIO Bucket Storage");
    process.exit(1);
  }
})();

(async () => {
  try {
    await connectRedis();
  } catch (error: any) {
    process.exit(1);
  }
})();
(async () => {
  try {
    await qdrant_client.getCollections();

    console.log("QRANT connected", process.env.QDRANT_PORT);
  } catch (error) {
    console.error("Error occured while connecting to qdrant");
    process.exit(1);
  }
})();

const SERVER_PORT = process.env.SERVER_PORT;

app.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});
