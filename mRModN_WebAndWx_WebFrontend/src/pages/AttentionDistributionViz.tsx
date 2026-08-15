import React from 'react';
import { useQuery } from '@tanstack/react-query';
import * as echarts from 'echarts';
import { Alert, Select, Space, Switch, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { fetchAttentionDistribution } from '../lib/api';
import type { AttentionDistributionClass } from '../lib/api';

const COLORS: Record<string, string> = {
  Am: '#8DA9C4', Atol: '#B5838D', Cm: '#A3B18A', Gm: '#DDB892',
  Tm: '#D8AE58', Y: '#9E9E9E', ac4C: '#C9ADA7', m1A: '#A28B8B',
  m5C: '#8B9DAF', m6A: '#5267D8', m6Am: '#C4A882', m7G: '#57A782',
};

function AttentionChart({
  value,
  modeledRange,
}: {
  value: AttentionDistributionClass;
  modeledRange: { start: number; end: number };
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const color = COLORS[value.name] || '#5267D8';
    chart.setOption({
      animationDuration: 300,
      tooltip: {
        trigger: 'axis',
        formatter: (items: unknown) => {
          const item = (Array.isArray(items) ? items[0] : items) as {
            dataIndex?: number;
            value?: string | number;
          };
          return `位置 ${String((item as { name?: string }).name || Number(item?.dataIndex ?? 0) + modeledRange.start + 1)}<br/>注意力 ${Number(item?.value ?? 0).toFixed(6)}`;
        },
      },
      grid: { left: 56, right: 20, top: 28, bottom: 42 },
      dataZoom: value.attention.length > 200 ? [{ type: 'inside' }, { type: 'slider', height: 18 }] : undefined,
      xAxis: {
        type: 'category',
        data: Array.from({ length: value.attention.length }, (_, i) => modeledRange.start + i + 1),
        axisLabel: { interval: Math.max(0, Math.floor(value.attention.length / 8) - 1) },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#EEF0F5' } } },
      series: [{
        type: 'line', data: value.attention, symbol: 'none', sampling: 'lttb',
        lineStyle: { color, width: 2 }, areaStyle: { color, opacity: 0.14 },
      }],
    });
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [value, modeledRange]);
  return <div ref={ref} style={{ width: '100%', height: 360 }} />;
}

interface Props { jobId?: string; compact?: boolean }

const AttentionDistributionViz: React.FC<Props> = ({ jobId: jobIdProp, compact = false }) => {
  const params = useParams<{ jobId: string }>();
  const jobId = jobIdProp || params.jobId;
  const [predictedOnly, setPredictedOnly] = React.useState(true);
  const [selectedIndex, setSelectedIndex] = React.useState<number | undefined>();
  const query = useQuery({
    queryKey: ['attention-distribution', jobId, predictedOnly],
    queryFn: () => fetchAttentionDistribution(jobId!, predictedOnly),
    enabled: !!jobId,
  });
  const classes = React.useMemo(() => query.data?.classes || [], [query.data?.classes]);
  React.useEffect(() => {
    if (classes.length && !classes.some((item) => item.index === selectedIndex)) {
      setSelectedIndex(classes[0].index);
    }
  }, [classes, selectedIndex]);
  if (!jobId) return <Alert type="info" message="缺少任务 ID" />;
  if (query.isLoading) return <div style={{ padding: 32 }}>正在读取任务缓存中的注意力分布…</div>;
  if (query.isError) return <Alert type="warning" message="暂无缓存的注意力分布" description={(query.error as Error).message} />;
  if (!classes.length) return <Alert type="info" message="当前筛选条件下没有可展示的修饰类别" />;
  const selected = classes.find((item) => item.index === selectedIndex) || classes[0];
  return <div style={{ padding: compact ? 8 : 0 }}>
    <Space wrap style={{ marginBottom: 16 }}>
      <Select
        value={selected.index}
        style={{ minWidth: 180 }}
        onChange={setSelectedIndex}
        options={classes.map((item) => ({ value: item.index, label: `${item.name} · ${(item.probability * 100).toFixed(1)}%` }))}
      />
      <Space><Switch checked={!predictedOnly} onChange={(checked) => setPredictedOnly(!checked)} />显示全部类别</Space>
    </Space>
    <div style={{ background: '#fff', border: '1px solid #E8EBF2', borderRadius: 16, padding: compact ? 8 : 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>{selected.name}</Typography.Title>
      <Typography.Text type="secondary">
        分类概率 {(selected.probability * 100).toFixed(2)}% · 阈值 {(selected.threshold * 100).toFixed(2)}%
      </Typography.Text>
      <AttentionChart value={selected} modeledRange={query.data!.modeled_range} />
    </div>
  </div>;
};

export default AttentionDistributionViz;
