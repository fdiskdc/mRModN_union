import React from 'react';
import { Alert, Segmented, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchResult, isCompleted, isFailed, isProcessing } from '../lib/api';
import { useRna } from '../context/RnaContext';
import GcnViz from './GcnViz';
import AttentionDistributionViz from './AttentionDistributionViz';
import IntegratedGradientsViz from './IntegratedGradientsViz';

type EmbedTab = 'gcn' | 'attention' | 'integrated-gradients';

const EmbedResultsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setRnaSequence } = useRna();
  const rawTab = searchParams.get('tab');
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
  if (query.isLoading || isProcessing(query.data)) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" tip="正在加载分析结果…" /></div>;
  if (query.isError || isFailed(query.data)) return <Alert type="error" showIcon message="结果加载失败" description={(query.error as Error)?.message || query.data?.error} />;
  if (!query.data || !isCompleted(query.data)) return <Alert type="warning" message="任务结果不可用" />;
  return <main style={{ minHeight: '100vh', background: '#F5F7FB', padding: 12 }}>
    <Segmented
      block
      value={tab}
      options={[{ label: 'RNA 3D', value: 'gcn' }, { label: '注意力', value: 'attention' }, { label: '积分梯度', value: 'integrated-gradients' }]}
      onChange={(value) => setSearchParams({ tab: String(value) })}
      style={{ marginBottom: 12 }}
    />
    {tab === 'gcn' && <GcnViz data={query.data.gcn} />}
    {tab === 'attention' && <AttentionDistributionViz jobId={jobId} compact />}
    {tab === 'integrated-gradients' && <IntegratedGradientsViz />}
  </main>;
};

export default EmbedResultsPage;
