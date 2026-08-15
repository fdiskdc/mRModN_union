Component({ properties: { result: Object }, methods: { open(e) { this.triggerEvent('open', { tab: e.currentTarget.dataset.tab }); } } });
