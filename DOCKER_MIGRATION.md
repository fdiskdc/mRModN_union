# Docker 迁移说明（前端 9006，后端 9005）

项目根目录的 `Dockerfile` 生成一个 ARM64 自包含镜像，镜像内同时包含：

- React 前端静态文件和 Nginx；
- Flask/Gunicorn 后端与 Python 依赖；
- Redis 和 Celery worker；
- RNA 模型权重、配置、可视化数据和 LinearFold；
- ReID 的 `outputs/best.pt` 与 `SYSU-MM01` 数据集。

端口关系：

- `9006`：前端页面，对外提供访问；
- `9005`：后端 API，可独立对外访问；
- 前端的 `/mrmodn/api/...` 请求由 Nginx 转发到同一容器的
  `127.0.0.1:9005`，浏览器无需写死服务器 IP，也不会产生跨域问题。

## 在 WSL 构建 ARM64 镜像

目标服务器是 `aarch64`，必须构建 `linux/arm64` 镜像。本机代理监听
`7897` 时，通过 `host.docker.internal:7897` 供构建过程使用：

```bash
cd /home/dc/vscode/re_id_cluster
docker buildx build \
  --platform linux/arm64 \
  --load \
  --provenance=false \
  --tag re-id-cluster:9006-9005-arm64 \
  --build-arg HTTP_PROXY=http://host.docker.internal:7897 \
  --build-arg HTTPS_PROXY=http://host.docker.internal:7897 \
  --build-arg NO_PROXY=localhost,127.0.0.1,::1 \
  .

docker image inspect re-id-cluster:9006-9005-arm64 \
  --format '{{.Os}}/{{.Architecture}}'
```

检查结果必须为 `linux/arm64`。

## 本机仿真验证

```bash
docker run -d \
  --name re_id_cluster_9006_9005_test \
  --platform linux/arm64 \
  -p 127.0.0.1:19005:9005 \
  -p 127.0.0.1:19006:9006 \
  re-id-cluster:9006-9005-arm64

curl http://127.0.0.1:19005/api/health
curl http://127.0.0.1:19006/api/health
curl http://127.0.0.1:19006/mrmodn/api/v1/sample-sequence
```

## 导出并复制到离线服务器

```bash
docker save re-id-cluster:9006-9005-arm64 | gzip -1 \
  > /home/dc/vscode/re_id_cluster_9006_9005_arm64_image.tar.gz

cd /home/dc/vscode
sha256sum re_id_cluster_9006_9005_arm64_image.tar.gz \
  > re_id_cluster_9006_9005_arm64_image.tar.gz.sha256
```

把 `.tar.gz` 和 `.sha256` 文件复制到服务器。服务器无需访问外网：

```bash
sha256sum -c re_id_cluster_9006_9005_arm64_image.tar.gz.sha256
gzip -dc re_id_cluster_9006_9005_arm64_image.tar.gz | sudo docker load

sudo docker image inspect re-id-cluster:9006-9005-arm64 \
  --format '{{.Os}}/{{.Architecture}}'

sudo docker rm -f re_id_cluster_9006_9005 2>/dev/null || true
sudo docker run -d \
  --name re_id_cluster_9006_9005 \
  --restart unless-stopped \
  --init \
  -p 9005:9005 \
  -p 9006:9006 \
  re-id-cluster:9006-9005-arm64
```

## 验证和访问

```bash
sudo docker ps
sudo docker logs --tail 100 re_id_cluster_9006_9005
curl http://127.0.0.1:9005/api/health
curl http://127.0.0.1:9006/api/health
```

- 前端：`http://服务器IP:9006/`
- 后端健康检查：`http://服务器IP:9005/api/health`
- 后端 API：`http://服务器IP:9005/api/v1/...`
- 前端同源代理：`http://服务器IP:9006/mrmodn/api/v1/...`

服务器防火墙或安全组至少放行 TCP `9006`。只有确实需要让外部客户端直接调用
后端时才放行 TCP `9005`；否则可将后端端口改为仅绑定服务器回环地址：

```bash
-p 127.0.0.1:9005:9005 -p 9006:9006
```

服务器完全离线时不要设置 WSL 的 `host.docker.internal:7897` 代理。微信登录、外部
API 等真正依赖公网的功能仍需服务器能够访问相应网络。
