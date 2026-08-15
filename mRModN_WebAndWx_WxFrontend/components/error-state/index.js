Component({ properties: { message: String }, methods: { retry() { this.triggerEvent('retry'); } } });
