Component({ properties: { value: String, tabs: Array }, methods: { onTap(e) { this.triggerEvent('change', { value: e.currentTarget.dataset.value }); } } });
