const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      settings: {
        affiliateUsername: '',
        affiliatePassword: '',
        redirectLink: ''
      },
      errors: {
        affiliateUsername: '',
        affiliatePassword: '',
        redirectLink: ''
      },
      loading: true,
      error: ''
    };
  },
  methods: {
    validateSettings() {
      this.errors = { affiliateUsername: '', affiliatePassword: '', redirectLink: '' };
      let valid = true;

      if (!this.settings.affiliateUsername.trim()) {
        this.errors.affiliateUsername = 'Affiliate username is required.';
        valid = false;
      }
      if (!this.settings.affiliatePassword.trim()) {
        this.errors.affiliatePassword = 'Affiliate password is required.';
        valid = false;
      }
      if (!this.settings.redirectLink.match(/^https?:\/\/[^\s]+$/)) {
        this.errors.redirectLink = 'Please enter a valid URL.';
        valid = false;
      }
      return valid;
    },
    saveSettings() {
      if (this.validateSettings()) {
        console.log('Saving settings:', this.settings);
        this.emitSettings();
        window.dispatchEvent(new Event('customWidgetSettingsSaved'));
      }
    },
    retry() {
      this.loading = true;
      this.error = '';
      this.initHandshake();
    },
    emitSettings() {
      console.log('Emitting settings:', this.settings);
      try {
        parent?.postMessage({
          type: 'code',
          value: {
            html: '',
            js: '',
            elementStore: this.settings
          }
        }, '*');
      } catch (err) {
        console.error('Failed to emit settings:', err);
        this.error = 'Failed to save settings. Please try again.';
      }
    },
    initHandshake(attempt = 1, maxAttempts = 5) {
      console.log(`Settings handshake attempt ${attempt}/${maxAttempts}`);
      const handshake = new Postmate.Model({
        elementStore: (data) => {
          console.log('Settings received:', data?.elementStore || 'No settings');
          if (data?.elementStore) {
            this.settings.affiliateUsername = data.elementStore.affiliateUsername || '';
            this.settings.affiliatePassword = data.elementStore.affiliatePassword || '';
            this.settings.redirectLink = data.elementStore.redirectLink || '';
          }
          this.loading = false;
        }
      });
      handshake.then(parent => {
        console.log('Settings handshake successful');
        this.loading = false;
      }).catch(err => {
        console.error(`Settings handshake failed (attempt ${attempt}):`, err);
        if (attempt < maxAttempts) {
          setTimeout(() => this.initHandshake(attempt + 1, maxAttempts), 1000 * attempt);
        } else {
          console.error('Settings handshake max attempts reached');
          this.loading = false;
          this.error = `Failed to connect to funnel builder: ${err.message}.`;
        }
      });
    }
  },
  template: `
    <div class="myWidget-container">
      <div v-if="loading" class="myWidget-loading">Loading settings...</div>
      <div v-else-if="error" class="myWidget-error">
        {{ error }}
        <button class="myWidget-btn" @click="retry">Retry</button>
      </div>
      <div v-else class="myWidget-form">
        <h2>Widget Settings</h2>
        <div class="myWidget-field">
          <label>Affiliate Username</label>
          <input v-model="settings.affiliateUsername" placeholder="Enter username">
          <span class="myWidget-error" v-if="errors.affiliateUsername">{{ errors.affiliateUsername }}</span>
        </div>
        <div class="myWidget-field">
          <label>Affiliate Password</label>
          <input type="password" v-model="settings.affiliatePassword" placeholder="Enter password">
          <span class="myWidget-error" v-if="errors.affiliatePassword">{{ errors.affiliatePassword }}</span>
        </div>
        <div class="myWidget-field">
          <label>Redirect Link</label>
          <input v-model="settings.redirectLink" placeholder="Enter redirect URL">
          <span class="myWidget-error" v-if="errors.redirectLink">{{ errors.redirectLink }}</span>
        </div>
        <button class="myWidget-btn" @click="saveSettings">Save Settings</button>
      </div>
    </div>
  `,
  mounted() {
    console.log('Settings UI mounted');
    this.initHandshake();
    setTimeout(() => {
      if (this.loading) {
        console.error('Settings handshake timeout');
        this.loading = false;
        this.error = 'Connection timed out. Please try again.';
      }
    }, 10000);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  app.mount('#app');
});