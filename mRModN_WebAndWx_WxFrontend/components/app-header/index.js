Component({
  properties: {
    isLoggedIn: Boolean,
    isLogging: Boolean,
    userInfo: { type: Object, value: {} },
  },
  methods: {
    onLogin() { this.triggerEvent('login'); },
    onLogout() { this.triggerEvent('logout'); },
  },
});
