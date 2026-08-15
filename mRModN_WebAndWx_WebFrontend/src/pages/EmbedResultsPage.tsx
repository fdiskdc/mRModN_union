import React from 'react';
import { Alert, Segmented, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchResult, isCompleted, isFailed, isProcessing } from '../lib/api';
import { useRna } from '../context/RnaContext';
import AttentionDistributionViz from './AttentionDistributionViz';
import IntegratedGradientsViz from './IntegratedGradientsViz';

const GcnViz = React.lazy(() => import('./GcnViz'));

type EmbedTab = 'gcn' | 'attention' | 'integrated-gradients';

const LoadingShell: React.FC<{ text?: string }> = ({ text = '正在加载分析结果…' }) => (
  <div style={{
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'linear-gradient(145deg, #F7F8FC 0%, #EEF1FF 100%)',
    color: '#5267D8',
  }}>
    <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
      <Spin size="large" />
      <strong>{text}</strong>
      <span style={{ color: '#7B8394', fontSize: 13 }}>请保持页面开启，加载完成后即可旋转和缩放</span>
    </div>
  </div>
);

class VisualizationErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('mRModN embedded visualization failed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F5F7FB' }}>
        <Alert
          type="error"
          showIcon
          message="交互式 3D 初始化失败"
          description="当前微信 WebView 可能无法创建 WebGL 场景。请重新加载，或返回小程序查看 RNA 二维结构。"
          action={<button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: '#5267D8', color: '#fff' }}>重新加载</button>}
        />
      </div>
    );
  }
}

const EmbedResultsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setRnaSequence } = useRna();
  const rawTab = searchParams.get('tab');
  const isWx = searchParams.get('source') === 'wx';
  const tab: EmbedTab = rawTab === 'attention' || rawTab === 'integrated-gradients' ? rawTab : 'gcn';
  const query = useQuery({
    queryKey: ['result', jobId],
    queryFn: () => fetchResult(jobId!),
    enabled: !!jobId,
    refetchInterval: (state) => isProcessing(state.state.data) ? 2500 : false,
  });

  React.useEffect(() => {
    const sequence = query.data?.sequence || query.data?.gcn?.sequence || query.data?.attention?.sequence;
    if (sequence) setRnaSequence(sequence);
  }, [query.data, setRnaSequence]);

  if (query.isLoading || isProcessing(query.data)) return <LoadingShell />;
  if (query.isError || isFailed(query.data)) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F5F7FB' }}>
      <Alert type="error" showIcon message="结果加载失败" description={(query.error as Error)?.message || query.data?.error} />
    </div>;
  }
  if (!query.data || !isCompleted(query.data)) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F5F7FB' }}>
      <Alert type="warning" showIcon message="任务结果不可用" />
    </div>;
  }

  return <main style={{ minHeight: '100vh', background: '#F5F7FB', padding: isWx ? 0 : 12 }}>
    {!isWx && <Segmented
      block
      value={tab}
      options={[{ label: 'RNA 3D', value: 'gcn' }, { label: '注意力', value: 'attention' }, { label: '积分梯度', value: 'integrated-gradients' }]}
      onChange={(value) => setSearchParams({ tab: String(value) })}
      style={{ marginBottom: 12 }}
    />}
    <VisualizationErrorBoundary key={`${jobId}-${tab}`}>
      {tab === 'gcn' && <React.Suspense fallback={<LoadingShell text="正在加载交互式 3D 组件…" />}><GcnViz data={query.data.gcn} compact={isWx} /></React.Suspense>}
      {tab === 'attention' && <AttentionDistributionViz jobId={jobId} compact />}
      {tab === 'integrated-gradients' && <IntegratedGradientsViz />}
    </VisualizationErrorBoundary>
  </main>;
};

export default EmbedResultsPage;
