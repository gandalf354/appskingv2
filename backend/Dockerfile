FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml* .
RUN sh -c "if [ -f pnpm-lock.yaml ]; then pnpm install --prod --frozen-lockfile; else pnpm install --prod; fi"
COPY . .
EXPOSE 5001
CMD ["node","server.js"]
