function cleanSequence(value) { return String(value || '').toUpperCase().replace(/[^ACGUTN]/g, ''); }
function validateSequence(value, minLength = 51, maxLength = 1001) {
  const sequence = cleanSequence(value);
  if (!sequence) return { valid: false, sequence, message: '请输入 RNA 序列' };
  if (sequence.length < minLength) return { valid: false, sequence, message: `至少需要 ${minLength} 个核苷酸` };
  if (sequence.length > maxLength) return { valid: false, sequence, message: `序列不能超过 ${maxLength} 个核苷酸` };
  return { valid: true, sequence, message: '序列格式正确' };
}
function summarizeSequence(value) {
  const sequence = cleanSequence(value);
  const counts = { A: 0, C: 0, G: 0, U: 0, N: 0 };
  sequence.split('').forEach((base) => { counts[base === 'T' ? 'U' : base] = (counts[base === 'T' ? 'U' : base] || 0) + 1; });
  return { length: sequence.length, counts, gc: sequence.length ? Math.round((counts.G + counts.C) / sequence.length * 100) : 0 };
}
module.exports = { cleanSequence, validateSequence, summarizeSequence };
