function percent(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
}

function prepareGroups(classification) {
  return ((classification && classification.children) || []).map((group) => ({
    ...group,
    probabilityText: percent(group.probability),
    children: (group.children || []).map((item) => ({
      ...item,
      probabilityText: percent(item.probability),
    })),
  }));
}

Component({
  properties: { classification: Object },
  data: { groups: [], positiveCount: 0 },
  observers: {
    classification(value) {
      const groups = prepareGroups(value);
      const positiveCount = groups.reduce(
        (count, group) => count + group.children.filter((item) => item.isPredicted).length,
        0,
      );
      this.setData({ groups, positiveCount });
    },
  },
});
