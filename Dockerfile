# Builds the test page (web/) and the backend (server/) into one image.
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./
COPY --from=web /web/dist /app/web
ENV WEB_DIST=/app/web MEDIA_DIR=/data/media
# Run as an unprivileged user, not root.
RUN useradd --system --uid 10001 app && mkdir -p /data/media && chown app /data/media
USER app
EXPOSE 8000
# Apply database migrations, then start the API. The access log is off because
# it would record participants' IP addresses, which count as personal data.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --proxy-headers"]
