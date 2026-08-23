import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://:myredissecret@redis:6379",
});

redis.on("error", (error) => {
  console.error("Redis Error", error);
});

export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();

    console.log("Redis connected");
  }
  
};

export const disconnectRedis = async () => {
  if (redis.isOpen) {
    await redis.quit();
    console.log("Redis disconnected");
  }
};

export default redis;
