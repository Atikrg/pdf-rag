import { container } from "./container/container";
import { errorHandler } from "./middleware/errorHandler";

const app = container.buildApp();

app.use(errorHandler);

(async () => {
  try {
    await container.connectInfrastructure();
  } catch (error: any) {
    console.error(error?.message ?? "Infrastructure connection failed");
    process.exit(1);
  }
})();

const SERVER_PORT = container.config.serverPort;

app.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});
