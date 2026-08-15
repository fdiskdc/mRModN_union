function percent(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
}

function prepareGroups(classification) {
  return ((classification && classification.children) || []).map((group) => ({
    ...group,
    probabilityText: percent(group.probability),
    children: (group.children || []).map((item) => ({ ...item, probabilityText: percent(item.probability) })),
  }));
}

Component({
  properties: { classification: Object },
  data: { groups: [], displayGroups: [], showAll: false, positiveCount: 0 },
  observers: {
    classification(value) {
      const groups = prepareGroups(value);
      this.updateDisplay(groups, false);
    },
  },
  methods: {
    updateDisplay(groups, showAll) {
      const positiveCount = groups.reduce((count, group) => count + group.children.filter((item) => item.isPredicted).length, 0);
      const displayGroups = showAll ? groups : groups.map((group) => ({
        ...group,
        children: group.children.filter((item) => item.isPredicted),
      })).filter((group) => group.children.length);
      this.setData({ groups, displayGroups, showAll, positiveCount });
    },
    toggleAll() { this.updateDisplay(this.data.groups, !this.data.showAll); },
  },
});
