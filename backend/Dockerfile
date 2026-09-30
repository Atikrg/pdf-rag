FROM oven/bun:1 AS install
WORKDIR /temp/dev
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS release
WORKDIR /app
COPY --from=install /temp/dev/node_modules ./node_modules
COPY . .
# Vendor the embedding model into the transformers.js local-model path
# (`env.localModelPath`). The sandbox has no reliable egress to
# huggingface.co, so the image must be able to build and run fully offline.
COPY models/Xenova ./node_modules/@huggingface/transformers/models/Xenova
ENV NODE_ENV=production
EXPOSE 5000
CMD ["sh", "-c", "bun run src/index.ts"]
