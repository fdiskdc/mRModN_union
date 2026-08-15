function edgeIndices(edge, nodeMap) {
  const source = typeof edge.sourceIndex === 'number' ? edge.sourceIndex : nodeMap[typeof edge.source === 'string' ? edge.source : edge.source.id];
  const target = typeof edge.targetIndex === 'number' ? edge.targetIndex : nodeMap[typeof edge.target === 'string' ? edge.target : edge.target.id];
  return [source, target];
}
function normalizeGraph(graph, sequence) {
  const nodes = (graph && graph.nodes) || String(sequence || '').split('').map((base, index) => ({ id: `${base}${index}`, index, base, label: `位置 ${index + 1}: ${base}` }));
  const nodeMap = {}; nodes.forEach((node, index) => { nodeMap[node.id] = typeof node.index === 'number' ? node.index : (node.data && node.data.index) || index; });
  const seen = {};
  const edges = ((graph && graph.edges) || []).map((edge) => {
    const pair = edgeIndices(edge, nodeMap); const a = Math.min(pair[0], pair[1]); const b = Math.max(pair[0], pair[1]);
    return { ...edge, sourceIndex: a, targetIndex: b, type: edge.type || (b - a === 1 ? 'backbone' : 'base_pair') };
  }).filter((edge) => {
    if (!Number.isInteger(edge.sourceIndex) || !Number.isInteger(edge.targetIndex)) return false;
    const key = `${edge.sourceIndex}:${edge.targetIndex}`; if (seen[key]) return false; seen[key] = true; return true;
  });
  return { ...(graph || {}), sequence: (graph && graph.sequence) || sequence || '', nodes, edges };
}
function topAttentionIndices(weights, count = 12) { return (weights || []).slice().sort((a, b) => b.score - a.score).slice(0, count).map((item) => item.index); }
module.exports = { normalizeGraph, topAttentionIndices };
