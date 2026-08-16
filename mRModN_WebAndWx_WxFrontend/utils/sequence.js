function cleanSequence(value) { return String(value || '').toUpperCase().replace(/[^ACGUTN]/g, ''); }
function validateSequence(value, minLength = 51, maxLength = 1001) {
  const sequence = cleanSequence(value);
  if (!sequence) return { valid: false, sequence, message: 'Enter an RNA sequence' };
  if (sequence.length < minLength) return { valid: false, sequence, message: `At least ${minLength} nucleotides are required` };
  if (sequence.length > maxLength) return { valid: false, sequence, message: `The sequence cannot exceed ${maxLength} nucleotides` };
  return { valid: true, sequence, message: 'Sequence format is valid' };
}
function summarizeSequence(value) {
  const sequence = cleanSequence(value);
  const counts = { A: 0, C: 0, G: 0, U: 0, N: 0 };
  sequence.split('').forEach((base) => { counts[base === 'T' ? 'U' : base] = (counts[base === 'T' ? 'U' : base] || 0) + 1; });
  return { length: sequence.length, counts, gc: sequence.length ? Math.round((counts.G + counts.C) / sequence.length * 100) : 0 };
}
module.exports = { cleanSequence, validateSequence, summarizeSequence };
