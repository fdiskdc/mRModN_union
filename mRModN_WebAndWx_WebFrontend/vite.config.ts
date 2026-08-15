/*
 * @Author: Chao Deng && chaodeng987@outlook.com
 * @Date: 2026-06-03 14:37:46
 * @LastEditors: Chao Deng && chaodeng987@outlook.com
 * @LastEditTime: 2026-07-16 09:56:51
 * @FilePath: /re_id_cluster/RGCNFormer_WebAndWx_WebFrontend/vite.config.ts
 * @Description: 
 * 那只是一场游戏一场梦
 *  
 * https://orcid.org/0009-0009-8520-1656
 * DOI: 10.3390/app15158626
 * DOI: 10.3390/rs17142354
 * Copyright (c) 2026 by ${Chao Deng}, All Rights Reserved. 
 */
/*
 * @Author: Chao Deng && chaodeng987@outlook.com
 */
/**
 * vite.config.ts - Vite 构建配置 / Vite build config
 *
 * Vite 配置:基础路径 `/mrmodn/`、React 插件、dev server 代理
 * `/mrmodn/api` → 后端 `/api`（由环境变量控制）。 / Vite config:
 * base `/mrmodn/`, React plugin, and a development proxy that rewrites
 * `/mrmodn/api` to the Flask backend `/api` path.
 *
 * 功能模块 / Modules:
 * - defineConfig(mode): Vite 配置工厂 / Vite config factory
 * - loadEnv: 加载 .env 模式环境变量 / Load .env mode env vars
 * - plugins: [react()]: React 插件 / React plugin
 * - server.proxy: /mrmodn/api 代理并重写到后端 / Proxy and rewrite to backend
 *
 * 输入 / Inputs:
 * - VITE_PROXY_TARGET: 后端地址(默认 http://localhost:9005)/ Backend URL
 * - VITE_APP_BASE_PATH: Web 子路径（默认 /mrmodn）/ Web subpath
 * - loadEnv 加载所有 VITE_* 环境变量 / All VITE_* env vars
 *
 * 输出 / Outputs:
 * - Vite Config 对象 / Vite Config object
 *
 * 数据流 / Data Flow:
 * 1. Vite 启动 → loadEnv → 决定 proxyTarget / Vite reads env, sets proxyTarget
 * 2. dev: 访问 /mrmodn/api/... → 重写并代理到 backend/api/...
 * 3. build: 静态资源 base 为 /mrmodn/ / Build assets under /mrmodn/
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: vite、@vitejs/plugin-react
 * - 被调用 / Called by: `npm run dev` / `npm run build`
 *
 * 使用示例 / Usage Example:
 *     # 默认代理 localhost:9005
 *     VITE_PROXY_TARGET=http://api.example.com npm run dev
 *
 * 作者 / Author: Chao Deng (chaodeng987@outlook.com)
 * 版本 / Version: 1.0
**/
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:9005'
  const appBasePath = (env.VITE_APP_BASE_PATH || '/mrmodn').replace(/\/$/, '')

  return {
    base: `${appBasePath}/`,
    plugins: [react()],
    server: {
      host: '0.0.0.0',  // 👈 添加这一行，监听所有网络接口
      port: 9006,
      proxy: {
        // 将 /mrmodn/api/* 重写为后端内部 /api/*
        [`${appBasePath}/api`]: {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${appBasePath}`), ''),
        },
      },
    },
  }
})
