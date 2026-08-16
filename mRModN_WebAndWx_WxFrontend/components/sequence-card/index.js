const { cleanSequence, validateSequence, summarizeSequence } = require('../../utils/sequence');
Component({
  properties: { value: String, index: Number, removable: Boolean },
  data: { focused: false },
  observers: {
    value(value) {
      const validation = value ? validateSequence(value) : { valid: false, message: 'Waiting for input' };
      this.setData({ summary: summarizeSequence(value), validation });
    }
  },
  methods: {
    onInput(e) { this.triggerEvent('change', { index: this.properties.index, value: cleanSequence(e.detail.value) }); },
    onFocus() { this.setData({ focused: true }); },
    onBlur() { this.setData({ focused: false }); },
    onRemove() { this.triggerEvent('remove', { index: this.properties.index }); }
  }
});
