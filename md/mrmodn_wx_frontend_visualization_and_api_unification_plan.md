# mRModN 微信小程序美化、可视化接入与前后端路径统一修改方案

文档日期：2026-08-15  
适用项目：

- `mRModN_WebAndWx_WxFrontend`
- `mRModN_WebAndWx_WebFrontend`
- `mRModN_WebAndWx_backend`

## 1. 文档目标

本方案用于指导 mRModN 微信小程序、Web 前端和统一后端的后续改造，解决以下三个核心问题：

1. 美化微信小程序首页、任务处理页和结果页，建立统一、专业、适合科研工具的视觉体系。
2. 将 Web 前端现有的 RNA/GCN 图结构可视化和注意力可视化接入微信小程序。
3. 统一 Web 前端和微信小程序访问后端时使用的域名、路径前缀、端点定义和部署规则。

本方案锁定的总体技术路线为：

> 微信小程序使用原生 WXML/WXSS 和 Canvas 2D 展示移动端核心结果；Web 前端继续提供完整 3D 可视化；小程序通过 WebView 提供“高级 3D 模式”；两端统一使用同一套后端数据契约和公共 API 路径。

## 2. 已确认的总体决策

### 2.1 小程序界面

- 不直接沿用当前以灰色为主、信息层级较弱的页面设计。
- 建立全局设计变量，包括品牌色、背景色、文字色、边框、阴影、圆角和 A/C/G/U 核苷酸颜色。
- 首页使用“品牌介绍 + 序列卡片 + 实时校验 + 底部主按钮”的结构。
- 结果页采用两层导航：第一层切换序列，第二层切换概览、分类、注意力和 RNA 结构。
- 默认语言使用中文，后续通过统一 i18n 文件支持英文，不在同一标题中并排堆叠中英文。

### 2.2 RNA 图结构

- 不尝试将 Web 端的 React、Three.js 或 `react-force-graph-3d` 直接复制到小程序。
- 小程序新增原生 Canvas 2D RNA 图组件。
- 小程序默认展示适合移动设备的 2D 结构图。
- Web 前端保留现有 3D 力导向图，并新增适合 WebView 嵌入的精简页面。
- 小程序通过“查看交互式 3D 结构”按钮打开 WebView 高级模式。

### 2.3 注意力可视化

- 保留并组件化小程序现有的 Top-X 注意力位点浏览功能。
- 新增完整注意力分布 Canvas 图表。
- 移动端一次只展示一个修饰类别的注意力曲线，不同时纵向堆叠 12 张图。
- Web 和小程序统一读取任务产生并缓存的完整注意力结果，避免对同一序列重复执行模型推理。

### 2.4 API 与部署路径

- 后端 Flask 内部路由继续保持 `/api/v1/*`。
- 推荐的生产环境公共 API 地址统一为：

```text
https://cmb.bnu.edu.cn/mrmodn/api/v1/*
```

- 推荐的生产环境 Web 地址统一为：

```text
https://cmb.bnu.edu.cn/mrmodn/*
```

- Nginx 将公共路径 `/mrmodn/api/v1/*` 重写并代理为后端内部路径 `/api/v1/*`。
- Web 和小程序只允许通过统一配置模块产生 API URL，业务页面中不得重复硬编码 `/api/v1`、`/mrmodn` 或 `/rgcnformer`。

## 3. 当前代码基线

### 3.1 微信小程序

主要目录：

```text
mRModN_WebAndWx_WxFrontend/
├── app.js
├── app.json
├── app.wxss
├── pages/
│   ├── index/
│   ├── results/
│   ├── webview/
│   └── logs/
└── utils/
    ├── config/api.js
    ├── request.js
    └── rnaExamples.js
```

当前已实现：

- 微信登录；
- 最多 5 条 RNA 序列输入；
- 批量任务提交；
- 批量任务进度轮询；
- 分类结果展示；
- Top-X 注意力位点展示；
- 多序列结果切换；
- WebView 基础页面。

当前主要不足：

- 首页缺少品牌区、结果能力说明和明确的视觉主色。
- 登录区域使用绝对定位，容易与页面内容和滚动区域冲突。
- 输入框聚焦时直接从 `100rpx` 扩展到 `500rpx`，多序列场景下页面跳动明显。
- 结果页把分类、注意力和 GCN 信息连续堆叠，移动端信息过长。
- GCN 目前只显示节点数和边数，没有真正绘图。
- 注意力只有 Top 位点窗口，没有完整分布曲线。
- 结果页文本以英文为主，首页则中英文混合，语言风格不统一。
- 批量结果通过页面 URL 传递完整 JSON，未来加入图数据和完整注意力后存在 URL 过长风险。

### 3.2 Web 前端

主要相关文件：

```text
mRModN_WebAndWx_WebFrontend/
├── config/api.config.ts
├── src/lib/api.ts
├── src/pages/AttentionViz.tsx
├── src/pages/AttentionDistributionViz.tsx
├── src/pages/GcnViz.tsx
├── src/pages/TargetGcnViz.tsx
├── src/pages/IntegratedGradientsViz.tsx
├── src/pages/ResultsPage.tsx
├── src/App.tsx
├── src/main.tsx
└── vite.config.ts
```

当前可复用能力：

- `GcnViz.tsx` 中主链边与碱基配对边的分类逻辑。
- A/C/G/U 节点配色和边的视觉语义。
- `AttentionViz.tsx` 中修饰类别筛选、Top-X、位点切换和序列窗口逻辑。
- `AttentionDistributionViz.tsx` 中注意力分布的数据结构、阈值和颜色语义。
- `src/lib/api.ts` 中端点组织、请求错误处理和结果类型定义。

不能直接复用到小程序的部分：

- React 组件生命周期和 JSX。
- Ant Design 控件。
- ECharts DOM 实例。
- Three.js、WebGL 和 `react-force-graph-3d`。
- 浏览器专用的 `window`、`document`、`MutationObserver` 和 DOM 尺寸计算。

因此迁移原则是：

> 复用数据协议、颜色、筛选规则、图结构语义和交互设计，不直接复用 React 组件实现。

### 3.3 后端

后端当前已经提供：

```text
POST /api/v1/wx/login
POST /api/v1/wx-submit-task
GET  /api/v1/wx-task-progress/<job_id>
POST /api/v1/submit-task
GET  /api/v1/results/<job_id>
GET  /api/v1/results/<job_id>/attention-distribution
POST /api/v1/attention-visualization
POST /api/v1/integrated-gradients
POST /api/v1/visualize-gcn-aggregation
```

任务结果已经包含：

```json
{
  "jobId": "...",
  "status": "completed",
  "classification": {},
  "attention": {
    "sequence": "...",
    "weights": []
  },
  "gcn": {
    "nodes": [],
    "edges": []
  }
}
```

后端任务还会单独缓存完整的逐类别注意力分布，并通过以下接口读取：

```text
GET /api/v1/results/<job_id>/attention-distribution
```

该接口应作为 Web 和小程序完整注意力可视化的首选数据源。

## 4. 目标架构

```text
                         ┌─────────────────────────────┐
                         │       Flask Backend         │
                         │       /api/v1/*             │
                         └──────────────▲──────────────┘
                                        │
                              Nginx rewrite/proxy
                                        │
                  /mrmodn/api/v1/*      │
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              │                                                   │
┌─────────────▼─────────────┐                       ┌─────────────▼─────────────┐
│ React Web Frontend        │                       │ WeChat Mini Program       │
│ /mrmodn/*                 │                       │ Native WXML/WXSS/Canvas   │
│                           │                       │                           │
│ - 完整结果页              │                       │ - 移动端结果概览          │
│ - 3D GCN/RNA 图           │◄──── WebView ─────────│ - 2D RNA 图               │
│ - 高级交互可视化          │                       │ - 注意力曲线              │
└───────────────────────────┘                       └───────────────────────────┘
```

数据流：

```text
提交序列
  -> 创建单任务或批任务
  -> 后端推理、LinearFold 和图数据生成
  -> Redis 缓存任务结果与完整注意力分布
  -> Web/小程序读取相同 jobId 对应的数据
  -> 两端使用各自渲染器展示相同分析结果
```

## 5. 小程序 UI/UX 改造方案

### 5.1 全局设计系统

在 `app.wxss` 中集中定义基础样式语义。小程序 WXSS 不保证完整支持浏览器 CSS 自定义变量，因此实施时可以采用“公共 class + 注释标记设计 token”的方式；如果目标基础库验证支持所需变量，也可以使用 CSS 变量。

推荐颜色：

| 语义 | 推荐值 |
|---|---|
| 品牌主色 | `#5267D8` |
| 品牌浅色 | `#EEF1FF` |
| 辅助青绿 | `#28A69A` |
| 页面背景 | `#F5F7FB` |
| 卡片背景 | `#FFFFFF` |
| 主文字 | `#172033` |
| 次文字 | `#6C7588` |
| 边框 | `#E8EBF2` |
| 成功 | `#35A36F` |
| 警告 | `#D7A33D` |
| 错误 | `#D95B62` |
| A | `#D98C8C` |
| C | `#629BD1` |
| G | `#57A782` |
| U/T | `#D8AE58` |
| N/填充 | `#C8CDD8` |

推荐尺寸：

| 语义 | 推荐值 |
|---|---|
| 页面水平边距 | `32rpx` |
| 卡片圆角 | `24rpx` |
| 控件圆角 | `16rpx` |
| 主按钮高度 | `92rpx` |
| 卡片间距 | `24rpx` |
| 标题字号 | `40rpx` |
| 分区标题 | `32rpx` |
| 正文字号 | `28rpx` |
| 辅助字号 | `24rpx` |

要求：

- 新页面以 `rpx` 为主要尺寸单位。
- 避免在同一页面混用大量 `vw`、`vh`、`em` 和百分比字号。
- 固定底部区域必须兼容 `env(safe-area-inset-bottom)`。
- 所有按钮至少提供普通、按下、禁用和加载四种状态。

### 5.2 首页布局

目标结构：

```text
┌────────────────────────────────┐
│ mRModN                    用户 │
│ RNA Modification Analysis     │
│ RNA 修饰识别与结构可视化       │
├────────────────────────────────┤
│ 支持 12 类修饰 · 最多 5 条序列 │
├────────────────────────────────┤
│ 序列 1                  删除   │
│ ┌────────────────────────────┐ │
│ │ ACGU...                    │ │
│ └────────────────────────────┘ │
│ 156 nt               格式正确 │
├────────────────────────────────┤
│ + 添加序列      换一个示例     │
├────────────────────────────────┤
│          开始分析              │
└────────────────────────────────┘
```

交互要求：

- 页面加载时可以继续填充随机示例，但应明确提供“换一个示例”和“清空”按钮。
- 输入时统一转换为大写，并根据产品规则决定是否自动移除空格和换行。
- 输入过程中实时校验字符范围和长度。
- 每条序列单独显示错误，不只在提交时统一弹 Toast。
- 添加序列后自动滚动到新增卡片。
- 登录信息放入正常头部布局，不再绝对定位悬浮在内容上方。
- 提交按钮固定在底部操作栏，并在键盘弹起时避免遮挡输入区。

建议新增组件：

```text
components/sequence-card/
components/app-header/
components/analysis-progress/
components/empty-state/
```

### 5.3 任务进度

当前全屏模态框可保留遮罩语义，但应改为更明确的任务进度卡：

```text
正在分析 RNA 序列
已完成 2 / 5
████████░░░░░░ 40%

当前步骤：生成结构图
```

后端暂时没有逐步骤进度时，可以只展示序列数量进度，不伪造模型内部百分比。

允许增加：

- “任务已在后台运行”的说明；
- 网络重试状态；
- 超时后的重新查询入口；
- 页面退出前提示任务仍在运行。

### 5.4 结果页导航

结果页改成两层导航。

第一层：序列切换。

```text
序列 1 | 序列 2 | 序列 3
```

第二层：结果模块切换。

```text
概览 | 分类 | 注意力 | RNA 结构
```

建议页面状态：

```js
{
  currentSequenceIndex: 0,
  currentResultTab: 'overview'
}
```

其中：

- `overview`：序列长度、检测到的修饰数量、最高概率类别、节点数和边数。
- `classification`：12 类修饰的分组结果和置信度。
- `attention`：Top 位点与完整注意力分布。
- `structure`：RNA 2D 结构图和高级 3D 入口。

### 5.5 分类结果

当前树形卡片可以保留 A/C/G/U 分组，但需要压缩未预测内容的视觉权重。

推荐默认行为：

- 顶部优先显示预测为真的修饰及置信度。
- 未预测类别折叠到“查看全部 12 类”。
- A/C/G/U 继续使用固定颜色。
- 不只依赖绿色边框表达预测状态，同时显示文本和图标。

示例：

```text
检测到 3 类修饰

A Adenine
  m6A    92.3%   已检测
  m6Am   73.1%   已检测

C Cytosine
  m5C    64.8%   已检测

查看全部类别 >
```

## 6. 注意力可视化接入方案

### 6.1 两种展示模式

小程序注意力页面分为两个子模式：

```text
关键位点 | 完整分布
```

#### 关键位点

复用现有逻辑：

- 选择修饰类型；
- 设置 Top-X；
- 查看前一个/后一个位点；
- 显示当前位置及得分；
- 显示以该位点为中心的序列窗口。

建议将以下逻辑从 `pages/results/results.js` 抽离：

- 修饰类别选项生成；
- 权重过滤和排序；
- 视口序列生成；
- A/C/G/U 颜色映射；
- 位点导航。

目标组件：

```text
components/attention-sites/
├── index.js
├── index.json
├── index.wxml
└── index.wxss
```

#### 完整分布

新增组件：

```text
components/attention-chart/
├── index.js
├── index.json
├── index.wxml
└── index.wxss
```

使用 Canvas 2D 绘制：

- 注意力折线；
- 半透明面积；
- 当前选中位置；
- Top 位点标记；
- X 轴位置刻度；
- 选中区间；
- 概率和修饰类别。

移动端一次只展示一个类别。类别通过 picker 或横向标签切换。

### 6.2 数据来源

完整注意力数据优先调用：

```text
GET /api/v1/results/<jobId>/attention-distribution
```

建议增加查询参数：

```text
?predictedOnly=true
```

默认只返回预测为真的类别，用户选择“查看全部类别”后再请求：

```text
?predictedOnly=false
```

Web 端的 `AttentionDistributionViz.tsx` 也应从当前的再次推理模式切换为读取任务缓存。

建议在 Web API 配置中增加：

```ts
ATTENTION_DISTRIBUTION: (jobId: string, predictedOnly = true) =>
  `${BASE_URL}/results/${jobId}/attention-distribution?predictedOnly=${predictedOnly}`
```

小程序增加对应端点函数。

### 6.3 Canvas 性能要求

- 按设备像素比对 Canvas 实际宽高进行缩放，避免曲线模糊。
- 对超过显示宽度的序列做可视区采样，不必每次绘制 1001 个文字标签。
- 数据变化时进行节流，不在每一次 touchmove 中触发大量 `setData`。
- Canvas 内部状态保存在组件实例中，WXML 数据只保存必要的 UI 状态。
- 切换序列或类别后销毁旧图状态，避免事件和缓存串线。

## 7. RNA/GCN 图结构接入方案

### 7.1 小程序 2D 图组件

新增：

```text
components/rna-graph/
├── index.js
├── index.json
├── index.wxml
└── index.wxss
```

第一版采用稳定、可解释的圆形结构布局：

- 节点按序列索引沿圆周排列；
- 相邻核苷酸之间绘制主链边；
- 非相邻配对绘制圆内部弦线；
- 节点按 A/C/G/U/N 着色；
- 主链边使用浅灰色；
- 配对边使用辅助青绿色；
- 选中节点使用品牌主色描边；
- 与当前注意力类别相关的高权重节点可以使用外圈或光晕高亮。

组件支持：

- 单指拖动；
- 双指缩放；
- 双击恢复视图；
- 点击节点；
- 选中节点信息卡；
- 显示/隐藏主链边；
- 显示/隐藏配对边；
- 根据注意力 Top-N 高亮节点。

### 7.2 长序列显示策略

对于接近 1001 nt 的序列，禁止为每个核苷酸创建独立 WXML 节点，应全部在 Canvas 中绘制。

按缩放级别控制细节：

| 缩放级别 | 显示内容 |
|---|---|
| 远景 | 节点点位和主要边，不显示文字 |
| 中景 | 显示 A/C/G/U 字母 |
| 近景 | 显示字母、位置和选中态 |

节点命中检测使用 Canvas 坐标和空间距离，不依赖 WXML 事件绑定到每个节点。

### 7.3 后端图数据改造

目前边只有：

```json
{
  "source": "A10",
  "target": "C11"
}
```

建议改成：

```json
{
  "source": "A10",
  "target": "C11",
  "sourceIndex": 10,
  "targetIndex": 11,
  "type": "backbone"
}
```

配对边：

```json
{
  "source": "A10",
  "target": "U83",
  "sourceIndex": 10,
  "targetIndex": 83,
  "type": "base_pair"
}
```

节点建议明确返回：

```json
{
  "id": "A10",
  "index": 10,
  "base": "A",
  "label": "位置 10: A"
}
```

建议的完整结构：

```json
{
  "sequence": "ACGU...",
  "structure": "(((...)))...",
  "nodes": [],
  "edges": [],
  "layout": {
    "type": "circular",
    "coordinates": [
      { "index": 0, "x": 0.5, "y": 0.1 }
    ]
  }
}
```

坐标使用归一化范围，推荐 `0.0-1.0`。Web 和小程序根据容器尺寸转换为像素坐标。

如果后端暂时不返回布局，小程序第一阶段可根据节点索引自行生成圆形坐标；后续再将布局计算统一到后端。

### 7.4 Web 3D 模式

Web 端保留：

- `GcnViz.tsx`；
- `TargetGcnViz.tsx`；
- `IntegratedGradientsViz.tsx`。

建议新增精简嵌入路由：

```text
/embed/results/:jobId
```

支持参数：

```text
?tab=gcn
?tab=attention
?tab=integrated-gradients
```

嵌入模式隐藏：

- 网站主导航；
- 工作区侧栏；
- 多余页脚；
- 不适合移动端的说明区。

小程序 RNA 结构页提供按钮：

```text
查看交互式 3D 结构
```

跳转目标：

```text
https://cmb.bnu.edu.cn/mrmodn/embed/results/<jobId>?tab=gcn
```

WebView 域名必须使用已经配置并允许的小程序业务域名，API 域名也必须使用允许的 request 合法域名。

## 8. API 路径统一方案

### 8.1 当前问题

当前 Web 使用：

```text
/mrmodn/api/v1
```

当前小程序使用：

```text
https://cmb.bnu.edu.cn/rgcnformer/api/v1
```

当前 WebView 代码生成：

```text
<webBase>/results/<jobId>
```

但 React 实际结果路由是：

```text
/classic/results/<jobId>
```

此外：

- Vite 生产 `base` 当前是 `/`；
- React `BrowserRouter` 当前没有 `basename`；
- Nginx 示例却使用 `/mrmodn/`；
- Vite 开发代理会去掉 `/mrmodn`，但生产 Nginx 示例没有明确执行相同重写。

这些问题必须在接入 WebView 和统一接口前解决。

### 8.2 统一规则

生产环境：

```text
Web Origin:  https://cmb.bnu.edu.cn
Web Base:    /mrmodn
API Prefix:  /mrmodn/api/v1
Backend:     http://127.0.0.1:9005/api/v1
```

开发环境：

```text
Web:         http://localhost:9006
API Public:  http://localhost:9006/mrmodn/api/v1
Backend:     http://localhost:9005/api/v1
```

小程序开发环境不能直接依赖 `localhost` 真机访问。需要局域网 HTTPS、测试域名或开发者工具的合法域名调试设置，具体按实际联调环境配置。

### 8.3 小程序配置重构

重构 `utils/config/api.js`：

```js
const ENVIRONMENTS = {
  production: {
    apiOrigins: [
      'https://cmb.bnu.edu.cn',
      'https://backup.example.com'
    ],
    appBasePath: '/mrmodn',
    apiPrefix: '/api/v1',
    webOrigin: 'https://cmb.bnu.edu.cn',
    webBasePath: '/mrmodn'
  }
};
```

URL 构造规则：

```js
function getApiBaseUrl() {
  return `${currentOrigin}${appBasePath}${apiPrefix}`;
}

function getWebBaseUrl() {
  return `${webOrigin}${webBasePath}`;
}
```

业务页面只使用不含基础前缀的端点：

```js
requestWithFallback(ENDPOINTS.WX_SUBMIT_TASK, options);
```

禁止继续写：

```js
requestWithFallback('/api/v1/wx-submit-task', options);
```

### 8.4 统一端点表

建议小程序和 Web 采用一致的端点命名：

| 名称 | 方法 | 路径 |
|---|---|---|
| `WX_LOGIN` | POST | `/wx/login` |
| `WX_SUBMIT_TASK` | POST | `/wx-submit-task` |
| `WX_TASK_PROGRESS` | GET | `/wx-task-progress/:batchJobId` |
| `SUBMIT_TASK` | POST | `/submit-task` |
| `RESULT` | GET | `/results/:jobId` |
| `ATTENTION_DISTRIBUTION` | GET | `/results/:jobId/attention-distribution` |
| `ATTENTION_VISUALIZATION` | POST | `/attention-visualization` |
| `INTEGRATED_GRADIENTS` | POST | `/integrated-gradients` |
| `GCN_AGGREGATION` | POST | `/visualize-gcn-aggregation` |
| `MODEL_GRAPH` | GET | `/model-graph` |

短期：

- Web 和小程序分别维护同名端点对象。
- 增加自动化测试确保关键端点后缀一致。

长期：

- 后端维护 OpenAPI 文档。
- 根据 OpenAPI 生成 Web TypeScript 类型和小程序 JavaScript 客户端。

### 8.5 Web 基础路径

如果生产环境确定部署在 `/mrmodn/`，修改 Vite：

```ts
base: '/mrmodn/'
```

修改 React Router：

```tsx
<BrowserRouter basename="/mrmodn">
```

更推荐通过环境变量统一：

```text
VITE_APP_BASE_PATH=/mrmodn
VITE_API_BASE_URL=/mrmodn/api/v1
```

开发和生产分别配置，不在源码多处硬编码。

### 8.6 Nginx

推荐配置：

```nginx
server {
    listen 443 ssl http2;
    server_name cmb.bnu.edu.cn;

    root /var/www/mrmodn;
    index index.html;

    location ^~ /mrmodn/api/ {
        rewrite ^/mrmodn(/api/.*)$ $1 break;
        proxy_pass http://127.0.0.1:9005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /mrmodn/ {
        try_files $uri $uri/ /mrmodn/index.html;
    }
}
```

实施前需要在实际服务器验证 `root`、构建产物目录和 `proxy_pass` 端口，不能直接假定示例路径与生产环境完全相同。

## 9. 请求封装改造

### 9.1 失败切换规则

当前小程序主备切换应进一步区分业务错误和服务器故障。

只有以下情况切换备用服务器：

- 网络连接失败；
- 请求超时；
- 502；
- 503；
- 504；
- 明确的网关或服务不可用错误。

以下状态不应切换服务器：

- 400 参数错误；
- 401 未登录；
- 403 无权限；
- 404 资源不存在；
- 409 状态冲突；
- 422 数据校验失败。

否则同一个错误请求会被无意义地重复发送到所有服务器。

### 9.2 统一响应处理

请求封装应统一返回：

```js
{
  ok: true,
  statusCode: 200,
  data: {},
  serverIndex: 0
}
```

失败统一抛出：

```js
{
  message: '序列格式不正确',
  statusCode: 422,
  code: 'INVALID_SEQUENCE',
  detail: {},
  retryable: false
}
```

页面不再直接判断大量原始 `wx.request` 字段。

### 9.3 超时与取消

- 请求封装增加合理超时。
- 页面卸载时停止轮询。
- 同一 batchJobId 不允许创建多个重复轮询定时器。
- 前台恢复时检查任务状态，避免小程序切到后台后定时器行为不一致。

## 10. 批量结果传输改造

当前流程将完整结果 JSON 放入页面 URL：

```text
/pages/results/results?results=<encoded JSON>
```

必须改为只传任务标识：

```text
/pages/results/results?batchJobId=<id>
```

结果页流程：

1. 从参数读取 `batchJobId`。
2. 请求 `GET /wx-task-progress/<batchJobId>`。
3. 将结果写入页面状态。
4. 切换序列时从本地结果列表读取。
5. 如结果不完整，根据单个 `jobId` 调用 `/results/<jobId>`。

可选优化：

- 首页在跳转前把简要结果写入 `wx.setStorageSync`，结果页先读缓存再后台刷新。
- Storage 只作为页面传递和短期缓存，后端 Redis 仍是最终数据源。

## 11. 微信登录与任务身份改造

当前小程序提交任务时携带微信临时 `code`，但后端 `wx-submit-task` 没有实际消费该字段。

建议流程：

```text
wx.login()
  -> POST /wx/login
  -> 后端交换 openid/session_key
  -> 后端签发自己的 session token
  -> 小程序保存 token
  -> 后续请求使用 Authorization
```

请求头：

```http
Authorization: Bearer <session-token>
```

任务提交不再重复传微信临时 code。

短期如暂不引入 token，也应：

- 删除任务提交中无效的 `code` 字段；或
- 明确后端对该字段的校验和用户关联逻辑。

不能保持“前端认为 code 用于用户身份，但后端实际忽略”的不一致状态。

## 12. 文件级修改清单

### 12.1 微信小程序

#### `app.json`

- 更新导航栏标题和颜色。
- 注册新增组件所在页面或使用页面级组件声明。
- 评估删除未使用的 `logs` 页面。

#### `app.wxss`

- 建立全局页面背景、文字、卡片、按钮、状态和安全区样式。
- 删除过于通用且会影响所有页面布局的旧 `.container` 定义，或改为更明确的命名。

#### `pages/index/index.js`

- 抽离序列清洗和校验。
- 不再保存和复用微信临时 code 作为任务身份。
- 结果跳转只传 `batchJobId`。
- 页面卸载和隐藏时统一管理轮询。

#### `pages/index/index.wxml`

- 重建品牌头部。
- 使用 `sequence-card` 组件。
- 增加示例、清空、校验状态和底部操作栏。

#### `pages/index/index.wxss`

- 删除登录绝对定位。
- 改成可滚动页面布局。
- 减少输入框聚焦时的剧烈高度跳变。
- 加入安全区和按钮状态。

#### `pages/results/results.js`

- 将分类、注意力和结构逻辑拆到组件或独立 utility。
- 新增 `currentResultTab`。
- 通过 `batchJobId` 重新拉取结果。
- 新增完整注意力接口请求。
- 新增 Canvas 结构图数据处理。
- 修正 WebView URL。

#### `pages/results/results.wxml`

- 改成序列切换 + 结果模块切换两层导航。
- 使用分类、注意力和 RNA 图组件。
- 增加概览卡。
- 增加高级 3D 按钮。

#### `pages/results/results.wxss`

- 重新整理为移动端卡片布局。
- 删除大量 `vw`、`em` 和重复 class 规则。
- 修复固定底栏和内容遮挡问题。

#### `pages/webview/index.js`

- 只允许打开配置中的可信 Web Origin。
- 检查 URL 参数和 jobId。
- 处理 WebView 消息。

#### `utils/config/api.js`

- 区分 origin、appBasePath、apiPrefix 和 webBasePath。
- 增加统一 ENDPOINTS。
- 将 `/rgcnformer` 改为最终确认的 `/mrmodn`。

#### `utils/request.js`

- 统一 URL 构造。
- 区分可重试错误与业务错误。
- 增加超时、错误对象和 token 请求头。

#### 新增组件

```text
components/app-header/
components/sequence-card/
components/analysis-progress/
components/result-summary/
components/result-tabs/
components/classification-tree/
components/attention-sites/
components/attention-chart/
components/rna-graph/
components/empty-state/
components/error-state/
```

#### 新增工具

```text
utils/constants/modifications.js
utils/constants/colors.js
utils/sequence.js
utils/graph.js
utils/i18n/zh.js
utils/i18n/en.js
```

### 12.2 Web 前端

#### `config/api.config.ts`

- 增加缓存注意力分布端点。
- 统一 app base 和 API base 的环境变量语义。

#### `src/lib/api.ts`

- 增加 `fetchAttentionDistribution(jobId, predictedOnly)`。
- 为图结构、完整注意力和嵌入页面增加明确类型。

#### `src/pages/AttentionDistributionViz.tsx`

- 优先根据结果 jobId 请求缓存数据。
- 避免对已完成任务重新执行模型推理。

#### `src/pages/GcnViz.tsx`

- 优先使用后端 `edge.type`，保留前端推断作为兼容逻辑。
- 支持后端提供的可选布局坐标。

#### `src/App.tsx`

- 新增 `/embed/results/:jobId` 路由。

#### `src/main.tsx`

- 为生产子路径部署设置 `BrowserRouter basename`。

#### `vite.config.ts`

- 统一 Vite base、开发代理前缀和生产环境变量。

#### `deploy/nginx.cluster.conf.example`

- 明确 `/mrmodn/api/` 到 `/api/` 的 rewrite。
- 更新实际后端端口说明。

### 12.3 后端

#### `server.py`

- 保留当前 `/api/v1` 内部路由。
- 如有需要，为完整注意力缓存接口补充统一错误码。
- 为图数据增加结构字符串、边类型和可选布局。
- 后续统一任务认证 token。

#### `tasks.py`

- 在构建 GCN 数据时直接标记边类型。
- 在结果中保留原始序列和 dot-bracket 结构。
- 保持完整注意力分布独立缓存，避免主结果过大。

建议结果：

```json
{
  "jobId": "...",
  "status": "completed",
  "sequence": "ACGU...",
  "classification": {},
  "attention": {
    "sequence": "ACGU...",
    "weights": []
  },
  "gcn": {
    "sequence": "ACGU...",
    "structure": "(((...)))",
    "nodes": [],
    "edges": [],
    "layout": null
  }
}
```

## 13. 实施阶段

### 阶段 0：建立修改基线

目标：避免 UI、API 和后端同时大范围修改后难以定位问题。

任务：

- 记录三部分当前可运行版本。
- 保存小程序首页、结果页和 Web 图页面截图。
- 记录当前生产域名、Nginx 配置和微信合法域名配置。
- 使用固定样例序列保存当前 API 响应样本。

验收：

- 能明确区分旧版和新版行为。
- 有固定测试 jobId 或可重复创建测试任务。

### 阶段 1：统一路径与请求层

任务：

- 修改小程序 API 配置和端点定义。
- 修改 Web base、Router basename 和 API base。
- 修改 Nginx rewrite。
- 修正 WebView 路径。
- 主备服务器使用相同路径和响应格式。
- 调整错误重试策略。

验收：

- Web 和小程序访问同一个公共 API 前缀。
- 开发环境和生产环境都不需要在业务页面改 URL。
- WebView 能打开正确的结果页。
- Nginx 上游收到的路径为 `/api/v1/*`。

### 阶段 2：结果传输与页面骨架

任务：

- 批量结果跳转只传 `batchJobId`。
- 结果页自行加载数据。
- 建立两层结果导航。
- 新增概览页。
- 拆分公共状态和组件。

验收：

- 5 条序列结果不会因 URL 过长跳转失败。
- 切换序列后分类、注意力和结构数据不会串线。
- 返回首页再进入结果页仍能恢复任务。

### 阶段 3：小程序视觉重构

任务：

- 重做首页。
- 重做进度状态。
- 重做分类结果和空状态。
- 建立中文默认文案和 i18n 基础。

验收：

- 常见屏幕尺寸下无横向溢出。
- 键盘不会遮挡主操作。
- 底部安全区正常。
- 登录、输入、删除、添加、提交和错误状态视觉一致。

### 阶段 4：注意力可视化

任务：

- 抽离 Top-X 组件。
- 接入缓存的完整注意力分布接口。
- 新增 Canvas 曲线。
- Web 端同步切换缓存接口。

验收：

- Web 和小程序同一 jobId、同一类别的注意力数组一致。
- 切换类别后概率、曲线和 Top 位点一致。
- 不重复执行不必要的模型推理。
- 1001 nt 序列可流畅查看。

### 阶段 5：RNA 2D 图

任务：

- 后端增加 `edge.type` 和 `structure`。
- 新增小程序 Canvas 图组件。
- 增加缩放、平移、点击和重置。
- 将注意力高亮映射到图节点。

验收：

- 节点数量和后端一致。
- 主链边与配对边数量和后端一致。
- 选中节点位置和序列索引一致。
- 长序列不会导致 WXML 节点过多或页面卡死。

### 阶段 6：WebView 高级 3D

任务：

- Web 新增嵌入模式路由。
- 小程序增加高级 3D 按钮。
- 校验可信域名和 URL。
- 测试 WebView 消息和返回流程。

验收：

- WebView 直接进入指定 jobId 的 GCN 图。
- 页面没有桌面端冗余导航。
- iOS 和 Android 微信中均可打开、缩放和返回。

### 阶段 7：登录和会话规范化

任务：

- 后端签发会话 token。
- 小程序请求统一携带 token。
- 任务与用户身份关联。
- 删除任务提交中的无效微信 code。

验收：

- 微信 code 只用于登录交换，不被重复使用。
- 未登录和 token 失效返回统一错误。
- 用户只能访问产品规则允许访问的任务。

## 14. 测试方案

### 14.1 API 测试

覆盖：

- 单序列提交；
- 5 序列批量提交；
- 空序列；
- 非法字符；
- 51 nt 边界；
- 1001 nt；
- 超过 1001 nt；
- 任务处理中；
- 任务完成；
- 单条任务失败；
- Redis 中无注意力缓存；
- 主服务器不可用；
- 业务参数错误不触发主备切换。

### 14.2 图数据一致性测试

对固定序列验证：

- `nodes.length === originalSequence.length`，截断规则另行明确时按有效序列验证；
- 每条边的 source/target 都存在；
- 主链边的索引差为 1；
- 配对边与 dot-bracket 结构一致；
- 不存在重复无向边；
- Web 和小程序使用相同边类型和节点索引。

### 14.3 注意力一致性测试

验证：

- 类别名称与 12 类索引一致；
- probability 与分类结果一致；
- attention 数组长度和序列映射规则一致；
- padding/trimming 后索引映射正确；
- Top-X 结果与完整注意力数组排序一致；
- T/U 兼容规则一致。

### 14.4 小程序设备测试

至少测试：

- 微信开发者工具；
- iOS 微信；
- Android 微信；
- 小屏设备；
- 大屏设备；
- 刘海屏和底部手势安全区；
- 弱网络；
- 小程序进入后台后恢复；
- WebView 返回；
- 1001 节点 Canvas 缩放和平移。

### 14.5 Web 回归测试

覆盖：

- `/mrmodn/` 首屏；
- `/mrmodn/classic/results/:jobId` 刷新；
- `/mrmodn/embed/results/:jobId` 刷新；
- API 代理；
- Attention Distribution 缓存读取；
- 3D GCN 图；
- 旧任务没有新字段时的兼容处理。

## 15. 兼容与迁移策略

后端新增字段时保持旧字段：

```json
{
  "source": "A10",
  "target": "U20",
  "sourceIndex": 10,
  "targetIndex": 20,
  "type": "base_pair"
}
```

旧 Web 仍可读取 `source` 和 `target`，新客户端优先使用新字段。

客户端兼容规则：

1. 有 `edge.type` 时直接使用。
2. 无 `edge.type` 时通过索引差判断 backbone/base_pair。
3. 有后端 layout 时使用后端坐标。
4. 无 layout 时使用客户端圆形布局。
5. 有缓存注意力接口时使用缓存。
6. 缓存不存在时显示明确提示，不默认无声重复执行高成本推理；是否允许手动重新计算由产品按钮决定。

## 16. 风险与应对

### 风险 1：1001 节点在移动端绘图性能不足

应对：

- Canvas 单画布；
- 分级显示；
- 减少文字；
- 预计算坐标；
- touchmove 节流；
- 只重绘变化区域或降低交互过程分辨率。

### 风险 2：Web 子路径配置不一致导致刷新 404

应对：

- Vite base、BrowserRouter basename 和 Nginx fallback 使用同一个 `/mrmodn` 配置。
- 增加生产构建后的路由刷新测试。

### 风险 3：主备服务器响应版本不同

应对：

- 主备部署相同后端版本。
- 健康检查返回 API version 和 build id。
- 客户端记录实际响应服务器和版本。

### 风险 4：完整注意力数据响应较大

应对：

- 默认只返回 predicted classes。
- 启用 gzip/brotli。
- 按需加载，不在结果概览阶段加载。
- 必要时增加类别级接口或数据压缩。

### 风险 5：WebView 业务域名或路径未配置

应对：

- 在开发前确认小程序后台的业务域名和 request 域名。
- WebView 只使用配置中的生产 HTTPS 域名。
- 原生 2D 图必须可独立工作，WebView 不作为基础结果展示的唯一入口。

## 17. 最终验收标准

项目完成后必须满足：

### UI

- 首页、进度页和结果页视觉语言一致。
- 页面在主流设备上无明显溢出、遮挡和跳动。
- 分类、注意力和结构有清晰独立入口。
- 中文文案完整统一，英文切换有明确扩展位置。

### 可视化

- 小程序能够原生显示 Top 注意力位点。
- 小程序能够原生显示完整注意力分布。
- 小程序能够原生显示 RNA 2D 图。
- 注意力位点可映射并高亮 RNA 图节点。
- 高级 3D 图可通过 WebView 打开。

### API

- Web 和小程序使用相同公共 API 前缀。
- 页面中不存在散落的生产域名和 `/api/v1` 硬编码。
- Nginx 转发后 Flask 收到正确的 `/api/v1/*`。
- 完整注意力优先读取任务缓存。
- 批量结果不通过 URL 传递完整 JSON。

### 稳定性

- 单序列和 5 序列批量任务均可完成。
- 主备切换只针对可重试故障。
- 任务处理中、失败、超时和缓存缺失均有明确状态。
- 页面卸载后不存在残留轮询定时器。

## 18. 推荐执行顺序总结

```text
1. API 路径、Vite basename、Nginx rewrite
2. 请求封装和批量结果传输
3. 小程序首页与结果页页面骨架
4. 分类结果组件化与视觉重构
5. Top-X 注意力组件化
6. 缓存注意力分布接口接入
7. 小程序 Canvas 注意力曲线
8. 后端 GCN 数据补充 edge.type/structure
9. 小程序 Canvas RNA 2D 图
10. Web 嵌入路由和小程序 WebView 3D 模式
11. 微信 token 会话和用户任务关联
12. 全量回归、设备测试和生产部署验证
```

以上顺序将路径和数据契约放在 UI 与可视化之前，可避免在页面完成后因接口和部署路径变化产生二次返工。
