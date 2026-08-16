/**
 * GcnViz.tsx - GCN 图结构 3D 可视化(react-force-graph-3d)/ GCN graph 3D visualization
 *
 * /gcn 路由页面。使用 react-force-graph-3d 渲染 RNA 二级结构图(节点 = 核苷酸,
 * 边 = 配对关系),颜色按节点类型着色。流程:用户提交序列 → 后端推理 →
 * 返回图数据 → 渲染 3D 视图。提供自动旋转、暂停、重置视角等交互。
 * Page mounted at /gcn. Uses react-force-graph-3d to render the RNA secondary-structure
 * graph (nodes = nucleotides, edges = base pairs) with per-type coloring. Pipeline:
 * user submits sequence → backend inference → graph payload returned → 3D scene rendered.
 * Provides auto-rotation, pause, and camera-reset interactions.
 *
 * 功能模块 / Modules:
 * - 3D 力导向图(react-force-graph-3d)/ 3D force-directed graph
 * - 节点类型着色(N/M/P 等)/ Per-type node coloring
 * - 视角控制(自动旋转/暂停/重置)/ Camera controls
 * - 加载/错误状态(Spin, Alert)/ Loading/error states
 *
 * 输入 / Inputs:
 * - useRna().rnaSequence / jobId / setJobId: 来自 RnaContext / from RnaContext
 * - 后端 /api/v1/submit-task + /api/v1/get-result 轮询 / Submit + poll endpoints
 *
 * 输出 / Outputs:
 * - JSX.Element 3D 图容器 / 3D graph container JSX
 *
 * 数据流 / Data Flow:
 * 1. 用户输入序列 → setRnaSequence(rnaSequence)
 * 2. 点击"提交" → submitTask(...) → 拿到 jobId
 * 3. 轮询 getResult → 拿到 graph payload(节点/边/坐标)
 * 4. 构造 GraphData → 喂给 <ForceGraph3D>
 * 5. 用户操作相机(滚轮缩放、拖拽旋转)
 *
 * 相关文件 / Related Files:
 * - 调用 / Calls: lib/api.ts(submitTask, generateJobId)、context/RnaContext
 * - 被调用 / Called by: App.tsx(<Route path="/gcn">)
 * - 关联 / Related: TargetGcnViz.tsx(目标节点 GCN)、ModelViz.tsx(模型图)
 *
 * 使用示例 / Usage Example:
 *   // App.tsx
 *   <Route path="/gcn" element={<GcnViz />} />
 *   // 浏览器访问 http://host:5173/rgcnformer/gcn
 */
import React, { useState, useEffect, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { Spin, Alert, Card, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useRna } from '../context/RnaContext';
import { useTranslation } from '../lib/i18n/LanguageContext';
import { submitTask, generateJobId } from '../lib/api';

interface Node {
  id: string;
  label?: string;
  data?: {
    index: number;
    type: string;
  };
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  sourceIndex?: number;
  targetIndex?: number;
  type?: 'backbone' | 'base_pair';
}

interface GraphData {
  sequence?: string;
  structure?: string;
  nodes: Node[];
  edges: Link[];
  layout?: { type: string; coordinates: Array<{ index: number; x: number; y: number }> } | null;
}

interface ClassifiedLinks {
  backboneLinks: Link[];
  pairingLinks: Link[];
}

// Morandi nucleotide color scheme - each nucleotide gets a distinct Morandi color
const NUCLEOTIDE_MORANDI_COLORS = {
  'A': '#af9d8f', // 灰褐/米色调 (A)
  'C': '#8ea7a5', // 灰绿/灰蓝色调 (C)
  'G': '#a1b18d', // 灰绿/橄榄绿调 (G)
  'U': '#c7b0b2', // 柔和粉/藕荷色调 (U)
  'T': '#c7b0b2', // T与U相同配色
  'N': '#d8d4d0'  // 极浅灰/米白调 (未知核苷酸 N)
};

// Morandi base colors for background and connections
const MORANDI_BASE_COLORS = {
  background: '#f4f1ea',    // 柔和米白 (背景)
  backboneLink: '#bfb8b0',  // 浅灰褐，用于主链连接
  pairingLink: '#8d9aab',   // 灰蓝色，用于配对连接
  nodeBorder: '#6d655f',    // 深灰，用于节点边框（可选）
  tube: '#a89a91',          // 烟灰粉/赭石 (保留用于其他用途)
};

// Legacy color palette name for backward compatibility
const MORANDI_COLORS = MORANDI_BASE_COLORS;

interface GcnVizProps {
  data?: GraphData;
  compact?: boolean;
}

const GcnViz: React.FC<GcnVizProps> = ({ data: propData, compact = false }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gcnData, setGcnData] = useState<GraphData | null>(null);
  const [renderReady, setRenderReady] = useState(false);
  const [webglAvailable] = useState(() => {
    if (typeof document === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const graphRef = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classifiedLinksRef = useRef<ClassifiedLinks | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { rnaSequence, dataset, datasetIndex } = useRna();

  // Helper function to classify links
  const classifyLinks = (links: Link[], nodes: Node[]): ClassifiedLinks => {
    const backboneLinks: Link[] = [];
    const pairingLinks: Link[] = [];

    const nodeIndexMap = new Map<string, number>();
    nodes.forEach((node, index) => {
      nodeIndexMap.set(node.id, index);
    });

    links.forEach((link) => {
      if (link.type === 'backbone') {
        backboneLinks.push(link);
        return;
      }
      if (link.type === 'base_pair') {
        pairingLinks.push(link);
        return;
      }
      const sourceNode = typeof link.source === 'string' 
        ? nodes.find(n => n.id === link.source)
        : link.source;
      const targetNode = typeof link.target === 'string'
        ? nodes.find(n => n.id === link.target)
        : link.target;

      if (!sourceNode || !targetNode) return;

      const sourceIndex = nodeIndexMap.get(sourceNode.id) ?? -1;
      const targetIndex = nodeIndexMap.get(targetNode.id) ?? -1;

      // Backbone links are sequential (i to i+1 or i to i-1)
      const isBackbone = Math.abs(sourceIndex - targetIndex) === 1;

      if (isBackbone) {
        backboneLinks.push(link);
      } else {
        pairingLinks.push(link);
      }
    });

    return { backboneLinks, pairingLinks };
  };

  // Helper function to check if a link is a backbone connection
  const isBackboneLink = (link: Link): boolean => {
    if (link.type) return link.type === 'backbone';
    if (typeof link.sourceIndex === 'number' && typeof link.targetIndex === 'number') {
      return Math.abs(link.sourceIndex - link.targetIndex) === 1;
    }
    const sourceNode = typeof link.source === 'string' ? link.source : link.source.id;
    const targetNode = typeof link.target === 'string' ? link.target : link.target.id;
    
    const nodeIndexMap = new Map<string, number>();
    if (gcnData) {
      gcnData.nodes.forEach((node, index) => {
        nodeIndexMap.set(node.id, index);
      });
    }
    
    const sourceIndex = nodeIndexMap.get(sourceNode) ?? -1;
    const targetIndex = nodeIndexMap.get(targetNode) ?? -1;
    
    return Math.abs(sourceIndex - targetIndex) === 1;
  };


  // Update container size on window resize
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const availableWidth = rect.width;
      const availableHeight = rect.height;

      setContainerSize({ width: availableWidth, height: availableHeight });

    };

    updateSize();

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(updateSize, 100);
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const observer = new MutationObserver(updateSize);
    const siderElement = document.querySelector('.ant-layout-sider');
    if (siderElement) {
      observer.observe(siderElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  // Initialize custom physics and animation when graph data is loaded
  useEffect(() => {
    if (!gcnData || !graphRef.current || gcnData.nodes.length === 0) return;

    const graph = graphRef.current;

    // Classify links
    const classified = classifyLinks(gcnData.edges, gcnData.nodes);
    classifiedLinksRef.current = classified;

    type AdjustableForce = {
      strength: (value: number) => AdjustableForce;
      distance?: (value: number) => AdjustableForce;
    };
    const chargeForce = graph.d3Force('charge') as AdjustableForce | undefined;
    const linkForce = graph.d3Force('link') as AdjustableForce | undefined;
    const centerForce = graph.d3Force('center') as AdjustableForce | undefined;
    if (compact) {
      // Mobile/WebView balanced physics: restore force-directed relaxation while
      // keeping the simulation bounded so the mini-program does not stay blank.
      chargeForce?.strength(-48);
      linkForce?.distance?.(19).strength(0.12);
      centerForce?.strength(0.05);
    } else {
      chargeForce?.strength(-150);
      linkForce?.distance?.(20).strength(0.1);
      centerForce?.strength(0.1);
    }

    console.log('GCN Visualization initialized with', gcnData.nodes.length, 'nodes and', gcnData.edges.length, 'edges');
  }, [compact, gcnData]);

  useEffect(() => {
    const processData = (graphData: GraphData) => {
      // Clone the API payload so react-force-graph can resolve link endpoints
      // without mutating React Query's cached result object.
      const layoutCoordinates = new Map(
        (graphData.layout?.coordinates || []).map((coordinate) => [coordinate.index, coordinate]),
      );
      const nodeCount = Math.max(graphData.nodes.length, 1);
      const nodes = graphData.nodes.map((node, fallbackIndex) => {
        const nodeIndex = node.data?.index ?? fallbackIndex;
        const coordinate = layoutCoordinates.get(nodeIndex);
        const fallbackAngle = (fallbackIndex / nodeCount) * Math.PI * 2;
        const x = coordinate ? (coordinate.x - 0.5) * 400 : (node.x ?? Math.cos(fallbackAngle) * 150);
        const y = coordinate ? (coordinate.y - 0.5) * 400 : (node.y ?? Math.sin(fallbackAngle) * 150);
        const z = node.z ?? (compact ? Math.sin(fallbackIndex * 0.42) * 24 : 0);
        return {
          ...node,
          label: node.label || node.id,
          x,
          y,
          z,
          // Seed the simulation with backend coordinates; forces may then relax them.
        };
      });
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const edges = graphData.edges.map((link) => ({
        ...link,
        source: typeof link.source === 'string'
          ? (nodeMap.get(link.source) || link.source)
          : (nodeMap.get(link.source.id) || link.source),
        target: typeof link.target === 'string'
          ? (nodeMap.get(link.target) || link.target)
          : (nodeMap.get(link.target.id) || link.target),
      }));

      setRenderReady(false);
      setGcnData({ ...graphData, nodes, edges });
    };

    if (propData) {
      processData(propData);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      if (!rnaSequence) {
        setLoading(false);
        setError(t('No RNA sequence provided.'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apiData = await submitTask({
          jobId: generateJobId(),
          userId: 'user1',
          rnaSequence: rnaSequence,
          dataset: dataset,
          datasetIndex: datasetIndex,
        });
        if (!apiData.gcn) {
          throw new Error('Backend response does not contain GCN graph data.');
        }
        const graphData: GraphData = apiData.gcn;

        processData(graphData);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setError(t('Unable to load graph data: {message}').replace('{message}', message));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [compact, propData, rnaSequence, dataset, datasetIndex, t]);

  const fitGraph = (duration = 350) => {
    if (!graphRef.current || !gcnData?.nodes.length) return;
    graphRef.current.zoomToFit(duration, compact ? 28 : 60);
  };

  const revealGraph = () => {
    fitGraph(compact ? 250 : 500);
    setRenderReady(true);
  };

  // 即使力引擎没有触发 stop，也要在超时后显示画布，避免用户只看到白屏。
  useEffect(() => {
    if (!gcnData || !webglAvailable) return;
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = setTimeout(revealGraph, compact ? 650 : 1000);
    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [compact, gcnData, webglAvailable]);

  if (!propData && !rnaSequence) {
    return (
      <Alert
        message={t('Error')}
        description={
          <>
            {t('Please enter an RNA sequence.')} <Link to="/classic">{t('Return to Home')}</Link>
          </>
        }
        type="error"
        showIcon
      />
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {!compact && <Card
        style={{
          marginBottom: 16, 
          background: '#faf8f5', 
          borderColor: MORANDI_COLORS.tube,
          borderWidth: 1,
        }}
      >
        <Typography.Title level={4} style={{ color: '#333333', margin: 0 }}>
          {t('GCN Graph')}
        </Typography.Title>
        <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0, color: '#333333' }}>
          {t('The GCN Graph visualization displays the graph structure representation of your RNA sequence as processed by the Graph Convolutional Network. Each node represents a nucleotide in the sequence, and edges represent the structural relationships between them. Interact with the 3D graph by dragging to rotate, scrolling to zoom, and right-click dragging to pan.')}
        </Typography.Paragraph>
      </Card>}

      <div
        ref={containerRef}
        className="gcn-viz-container"
        style={{
          width: '100%',
          height: compact ? '100dvh' : '72vh',
          minHeight: compact ? '100vh' : '480px',
          maxHeight: compact ? 'none' : '760px',
          position: 'relative',
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          background: MORANDI_COLORS.background,
          borderRadius: compact ? 0 : '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {(loading || (gcnData && !renderReady && webglAvailable)) && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(145deg, #F7F8FC 0%, #EEF1FF 100%)',
            color: '#5267D8',
          }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <Spin size="large" />
              <strong>{loading ? t('Loading graph data...') : '正在初始化交互式 3D…'}</strong>
              <span style={{ color: '#7B8394', fontSize: 13 }}>首次打开需要加载 3D 渲染资源</span>
            </div>
          </div>
        )}
        {(error || !webglAvailable) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'grid', placeItems: 'center', padding: 24, background: '#F5F7FB' }}>
            <Alert
              message={webglAvailable ? t('Error') : '当前 WebView 不支持 3D 渲染'}
              description={error || '请更新微信或系统 WebView；也可以返回小程序查看 RNA 二维结构。'}
              type="error"
              showIcon
              action={<button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: '#5267D8', color: '#fff' }}>重新加载</button>}
            />
          </div>
        )}

        {gcnData && webglAvailable && containerSize.width > 0 && containerSize.height > 0 && (
          <ForceGraph3D
            ref={graphRef}
            graphData={{
              nodes: gcnData.nodes,
              links: gcnData.edges,
            }}
            width={containerSize.width}
            height={containerSize.height}
            rendererConfig={{
              antialias: !compact,
              alpha: false,
              powerPreference: 'high-performance',
            }}
            nodeLabel="label"
            nodeColor={(node) => {
              if (node.data && NUCLEOTIDE_MORANDI_COLORS[node.data.type as keyof typeof NUCLEOTIDE_MORANDI_COLORS]) {
                return NUCLEOTIDE_MORANDI_COLORS[node.data.type as keyof typeof NUCLEOTIDE_MORANDI_COLORS];
              }
              return NUCLEOTIDE_MORANDI_COLORS.N;
            }}
            nodeRelSize={compact ? 5 : 20}
            nodeResolution={compact ? 6 : 12}
            linkColor={(link) => isBackboneLink(link)
              ? MORANDI_BASE_COLORS.backboneLink
              : MORANDI_BASE_COLORS.pairingLink}
            linkWidth={(link) => compact
              ? (isBackboneLink(link) ? 1.2 : 2.4)
              : (isBackboneLink(link) ? 10 : 20)}
            linkOpacity={compact ? 0.72 : 1}
            linkResolution={compact ? 2 : 6}
            backgroundColor={MORANDI_BASE_COLORS.background}
            controlType="orbit"
            enableNavigationControls
            enableNodeDrag
            enablePointerInteraction
            showNavInfo={false}
            warmupTicks={compact ? 24 : 20}
            cooldownTicks={compact ? 80 : 200}
            cooldownTime={compact ? 4000 : 15000}
            onEngineStop={revealGraph}
          />
        )}

        {compact && renderReady && !error && webglAvailable && (
          <>
            <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => fitGraph()} style={{ border: '1px solid rgba(82,103,216,.25)', borderRadius: 999, padding: '9px 13px', background: 'rgba(255,255,255,.92)', color: '#3348B5', fontWeight: 700, boxShadow: '0 4px 14px rgba(23,32,51,.14)' }}>适应屏幕</button>
              <button type="button" onClick={() => graphRef.current?.cameraPosition({ x: 0, y: 0, z: 520 }, { x: 0, y: 0, z: 0 }, 350)} style={{ border: '1px solid rgba(82,103,216,.25)', borderRadius: 999, padding: '9px 13px', background: 'rgba(255,255,255,.92)', color: '#3348B5', fontWeight: 700, boxShadow: '0 4px 14px rgba(23,32,51,.14)' }}>重置视角</button>
            </div>
            <div style={{ position: 'absolute', left: '50%', bottom: 18, zIndex: 20, transform: 'translateX(-50%)', whiteSpace: 'nowrap', borderRadius: 999, padding: '7px 12px', background: 'rgba(23,32,51,.76)', color: '#fff', fontSize: 12 }}>单指旋转 · 双指缩放/移动</div>
          </>
        )}
      </div>

      {/* Nucleotide Legend - Horizontal below 3D model */}
      {!compact && <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '16px 24px',
        padding: '12px 16px',
        marginTop: '12px',
        background: 'rgba(244, 241, 234, 0.95)',
        borderRadius: '8px',
        border: `1px solid ${MORANDI_BASE_COLORS.tube}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <span style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#333333',
          marginRight: '8px',
        }}>
          {t('Nucleotide Legend')}
        </span>
        {Object.entries(NUCLEOTIDE_MORANDI_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: color,
              border: `2px solid ${MORANDI_BASE_COLORS.nodeBorder}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }} />
            <span style={{ fontSize: '12px', color: '#333333', fontWeight: '500' }}>
              {type}
            </span>
          </div>
        ))}
        <div style={{ width: '1px', height: '16px', background: MORANDI_BASE_COLORS.backboneLink, margin: '0 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '3px', backgroundColor: MORANDI_BASE_COLORS.backboneLink }} />
          <span style={{ fontSize: '12px', color: '#333333' }}>{t('Backbone')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '3px', backgroundColor: MORANDI_BASE_COLORS.pairingLink }} />
          <span style={{ fontSize: '12px', color: '#333333' }}>{t('Pairing')}</span>
        </div>
      </div>}
    </div>
  );
};

export default GcnViz;
