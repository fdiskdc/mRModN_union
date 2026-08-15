ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim
ARG PYTHON_IMAGE=docker.m.daocloud.io/library/python:3.11-slim

FROM ${NODE_IMAGE} AS frontend-builder

WORKDIR /build/frontend

COPY RGCNFormer_WebAndWx_WebFrontend/package.json \
     RGCNFormer_WebAndWx_WebFrontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 \
      --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=30000

COPY RGCNFormer_WebAndWx_WebFrontend/ ./
RUN npm run build


FROM ${PYTHON_IMAGE} AS runtime

ARG DEBIAN_FRONTEND=noninteractive
ARG UV_VERSION=0.11.28
ARG DEBIAN_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian
ARG DEBIAN_SECURITY_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/debian-security

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    sed -i \
      -e "s|http://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g" \
      -e "s|http://deb.debian.org/debian|${DEBIAN_MIRROR}|g" \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --fix-missing --no-install-recommends \
       build-essential \
       ca-certificates \
       nginx \
       redis-server \
       supervisor \
    && python -m pip install --no-cache-dir "uv==${UV_VERSION}"

COPY RGCNFormer_WebAndWx_backend/pyproject.toml \
     RGCNFormer_WebAndWx_backend/uv.lock ./

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:${PATH}"

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

# The backend source, RNA model, visualization data, and LinearFold executable
# are copied into the image so the deployed container needs no source bind mount.
COPY RGCNFormer_WebAndWx_backend/ ./
RUN make -C LinearFold \
    && rm -f ./*.log celery.pid

# ReID runtime assets previously mounted from the WSL host are deliberately
# embedded in the portable image.
COPY outputs/best.pt /opt/reid/outputs/best.pt
COPY SYSU-MM01/ /opt/reid/SYSU-MM01/

COPY --from=frontend-builder /build/frontend/dist/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/re_id_cluster.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/re_id_cluster.conf

RUN rm -f /etc/nginx/sites-enabled/default \
    && mkdir -p /run/nginx /var/log/supervisor

ENV REDIS_HOST=127.0.0.1 \
    REDIS_PORT=6379 \
    REDIS_DB=0 \
    CELERY_BROKER_URL=redis://127.0.0.1:6379/0 \
    CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0 \
    MODEL_CHECKPOINT_PATH=/app/epoch_040.pt \
    MODEL_CONFIG_PATH=/app/json/human.json \
    MODEL_DEVICE=cpu \
    REID_CHECKPOINT_PATH=/opt/reid/outputs/best.pt \
    REID_DATA_ROOT=/opt/reid/SYSU-MM01 \
    REID_DEVICE=cpu \
    BACKEND_PORT=9005 \
    FRONTEND_PORT=9006 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    GUNICORN_WORKERS=1 \
    CELERY_CONCURRENCY=1

EXPOSE 9005 9006

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9005/api/health', timeout=5); urllib.request.urlopen('http://127.0.0.1:9006/', timeout=5)" || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
