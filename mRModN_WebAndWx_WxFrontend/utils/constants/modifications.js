const MODIFICATIONS = [
  { index: 0, name: 'Am', base: 'A' }, { index: 1, name: 'Atol', base: 'A' },
  { index: 2, name: 'Cm', base: 'C' }, { index: 3, name: 'Gm', base: 'G' },
  { index: 4, name: 'Tm', base: 'U' }, { index: 5, name: 'Y', base: 'U' },
  { index: 6, name: 'ac4C', base: 'C' }, { index: 7, name: 'm1A', base: 'A' },
  { index: 8, name: 'm5C', base: 'C' }, { index: 9, name: 'm6A', base: 'A' },
  { index: 10, name: 'm6Am', base: 'A' }, { index: 11, name: 'm7G', base: 'G' }
];
module.exports = { MODIFICATIONS, MODIFICATION_BY_NAME: MODIFICATIONS.reduce((map, item) => { map[item.name] = item; return map; }, {}) };
