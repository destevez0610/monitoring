const { createApp } = Vue;

const clientId = 'YOUR_CLIENT_ID'; // placeholder - Replace with '6835b1cc2f5f6181968df6d6-mbbf0w40'
const redirectUri = 'https://your-render-server.onrender.com/oauth/callback'; // placeholder - Replace with your Render server URL

const app = createApp({
  data() {
    return {
      step: 1,
      form: {
        email: '',
        name: '',
        phone: '',
        monitoring_username: '',
        monitoring_password: ''
      },
      accessToken: '',
      affiliateUsername: '',
      affiliatePassword: '',
      redirectLink: '',
      loadingSettings: true,
      settingsError: '',
      status: '',
      message: '',
      timer: null,
      countdown: 10,
      signupLink: 'https://myfreescorenow.com/signup' // MyFreeScoreNow signup URL
    };
  },
  computed: {
    isStep1Valid() {
      return (
        this.form.name.trim() &&
        this.form.phone.match(/^\+?[\d\s-]+$/i) &&
        this.form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/i)
      );
    },
    isStep2Valid() {
      return this.form.monitoring_username.trim() && this.form.monitoring_password.trim();
    }
  },
  methods: {
    next() {
      if (this.isStep1Valid) {
        this.step = 2;
        this.message = '';
      } else {
        this.message = 'Please fill out all fields correctly.';
      }
    },
    startCountdown() {
      this.countdown = 10;
      this.timer = setInterval(() => {
        this.countdown--;
        if (this.countdown <= 0) {
          clearInterval(this.timer);
        }
      }, 1000);
    },
    async updateHighLevelContact() {
      if (!this.accessToken) {
        console.error('No access token provided');
        return;
      }
      try {
        // Upsert contact (create or update based on email)
        await fetch('https://rest.gohighlevel.com/v1/contacts/upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: JSON.stringify({
            email: this.form.email,
            name: this.form.name,
            phone: this.form.phone,
            customFields: {
              "contact.monitoring_username": this.form.monitoring_username,
              "contact.monitoring_password": this.form.monitoring_password
            }
          })
        });

        console.log('Contact upserted successfully');
      } catch (err) {
        console.error('Failed to upsert HighLevel contact:', err);
      }
    },
    initiateOAuth() {
      const scopes = 'contacts.readonly contacts.write locations/customFields.readonly locations/customFields.write';
      const authorizeUrl = `https://backend.leadconnectorhq.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&userType=Location`;
      const popup = window.open(authorizeUrl, 'oauthPopup', 'width=600,height=600');
      if (!popup) {
        this.settingsError = 'Failed to open OAuth popup. Please allow popups and try again.';
      }
    },
    emitWidget() {
      const widgetHtml = `
        <div class="myWidget-container">
          <div class="myWidget-form-row">
            <div class="myWidget-field">
              <label>Username</label>
              <input id="monitoringUsername" type="text" placeholder="Enter username">
            </div>
            <div class="myWidget-field">
              <label>Password</label>
              <input id="monitoringPassword" type="password" placeholder="Enter password">
            </div>
            <div class="myWidget-field">
              <button id="connectButton" class="myWidget-btn">Connect My Report</button>
            </div>
          </div>
          <div class="myWidget-iframe-wrapper">
            <iframe
              src="${this.redirectLink || 'https://example.com'}"
              width="100%"
              height="750"
              style="min-height: 750px; border: none; padding: 20px 0;"
            ></iframe>
          </div>
          <div id="myWidget-status" class="myWidget-status hidden"></div>
        </div>
      `;
      const widgetJs = `
        document.getElementById('connectButton').addEventListener('click', () => {
          const usernameInput = document.getElementById('monitoringUsername');
          const passwordInput = document.getElementById('monitoringPassword');
          const statusDiv = document.querySelector('#myWidget-status');
          window.parent.postMessage({
            type: 'verifyCredentials',
            username: usernameInput.value,
            password: passwordInput.value
          }, '*');
        });
      `;
      try {
        parent?.emit('code', {
          html: widgetHtml,
          js: widgetJs,
          elementStore: {
            affiliateUsername: this.affiliateUsername,
            affiliatePassword: this.affiliatePassword,
            redirectLink: this.redirectLink
          }
        });
      } catch (err) {
        console.error('Failed to emit widget:', err);
        this.settingsError = 'Failed to initialize widget.';
      }
    },
    async verifyCreditMonitoring(username, password) {
      try {
        this.status = 'verifying';
        this.message = 'Verifying credentials...';
        this.startCountdown();

        const contactParams = `name=${encodeURIComponent(this.form.name)}&phone=${encodeURIComponent(this.form.phone)}&email=${encodeURIComponent(this.form.email)}&credit_monitoring_service_login_username=${encodeURIComponent(username || this.form.monitoring_username)}&credit_monitoring_service_login_password=${encodeURIComponent(password || this.form.monitoring_password)}`;
        const successUrl = this.redirectLink && /^https?:\/\/[^\s]+$/.test(this.redirectLink)
          ? `${this.redirectLink}?${contactParams}`
          : null;

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 10000));

        const apiPromise = (async () => {
          const authEndpoint = 'https://api.myfreescorenow.com/api/auth/login';
          const reportEndpoint = 'https://api.myfreescorenow.com/api/auth/3B/report.json';

          const authResponse = await fetch(authEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: this.affiliateUsername,
              password: this.affiliatePassword
            })
          });

          const authData = await authResponse.json();
          if (!authData.success || !authData.data?.token) {
            throw new Error(`Authentication failed: ${authData.message || 'No token'}`);
          }

          const reportResponse = await fetch(reportEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.data.token}`
            },
            body: JSON.stringify({
              username: username || this.form.monitoring_username,
              password: password || this.form.monitoring_password
            })
          });

          const reportData = await reportResponse.json();
          if (reportData.success) {
            return true;
          } else {
            throw new Error(`Report failed: ${reportData.message || 'Unknown error'}`);
          }
        })();

        const result = await Promise.race([apiPromise, timeoutPromise]);

        clearInterval(this.timer);
        if (result === true) {
          await this.updateHighLevelContact();
          this.status = 'success';
          this.message = 'Verification successful! Redirecting...';
          setTimeout(() => {
            if (successUrl) {
              window.location.href = successUrl;
              window.dispatchEvent(new Event('customWidgetGoToNextStep'));
            } else {
              console.error('Invalid or missing redirect URL');
              this.status = 'error';
              this.message = 'Redirect failed. Please check widget configuration.';
            }
          }, 2000);
        } else {
          throw new Error('Verification timed out');
        }
      } catch (e) {
        console.error('Verification error:', e.message);
        clearInterval(this.timer);
        this.status = 'error';
        this.message = `Verification failed. Please sign up for a credit monitoring service <a href="${this.signupLink}" target="_blank">here</a> and try again.`;
      }
    }
  },
  template: `
    <div class="myWidget-container">
      <div v-if="loadingSettings" class="myWidget-loading">Loading widget...</div>
      <div v-else-if="settingsError" class="myWidget-error">{{ settingsError }}</div>
      <div v-else class="myWidget-form">
        <div v-if="step === 1">
          <h2>Enter Your Details</h2>
          <div class="myWidget-field">
            <label>Name</label>
            <input v-model="form.name" placeholder="Enter your name">
          </div>
          <div class="myWidget-field">
            <label>Phone</label>
            <input v-model="form.phone" placeholder="Enter your phone">
          </div>
          <div class="myWidget-field">
            <label>Email</label>
            <input v-model="form.email" placeholder="Enter your email">
          </div>
          <button class="myWidget-btn" @click="next" :disabled="!isStep1Valid">Next</button>
          <div class="myWidget-message" v-if="message">{{ message }}</div>
        </div>
        <div v-else-if="step === 2">
          <h2>Credit Monitoring Credentials</h2>
          <div class="myWidget-form-row">
            <div class="myWidget-field">
              <label for="monitoringUsername">Username</label>
              <input id="monitoringUsername" v-model="form.monitoring_username" placeholder="Enter username">
            </div>
            <div class="myWidget-field">
              <label for="monitoringPassword">Password</label>
              <input id="monitoringPassword" type="password" v-model="form.monitoring_password" placeholder="Enter password">
            </div>
            <div class="myWidget-field">
              <button id="connectButton" class="myWidget-btn" @click="verifyCreditMonitoring" :disabled="!isStep2Valid || status === 'verifying'">
                Connect My Report
              </button>
            </div>
          </div>
          <div class="myWidget-iframe-wrapper">
            <iframe
              src="${this.redirectLink || 'https://example.com'}"
              width="100%"
              height="750"
              style="min-height: 750px; border: none; padding: 20px 0;"
            ></iframe>
          </div>
          <div class="myWidget-message" v-if="message" v-html="message"></div>
          <div v-if="status === 'verifying'" class="myWidget-countdown">
            Verifying... {{ countdown }} seconds remaining
          </div>
          <div v-if="status === 'success'" class="myWidget-success">Success!</div>
          <div v-if="status === 'error'" class="myWidget-error">{{ message }}</div>
        </div>
      </div>
    </div>
  `,
  mounted() {
    console.log('Widget UI mounted');
    const handshake = new Postmate.Model({
      elementStore: (data) => {
        console.log('Widget received settings:', data?.elementStore || 'No settings');
        if (data?.elementStore) {
          this.affiliateUsername = data.elementStore.affiliateUsername || '';
          this.affiliatePassword = data.elementStore.affiliatePassword || '';
          this.redirectLink = data.elementStore.redirectLink || '';
        }
        this.loadingSettings = false;
        // Initiate OAuth if accessToken is not set
        if (!this.accessToken) {
          this.initiateOAuth();
        } else {
          this.emitWidget();
        }
      },
      verifyCredentials: ({ username, password }) => {
        this.form.monitoring_username = username;
        this.form.monitoring_password = password;
        this.verifyCreditMonitoring(username, password);
      }
    });
    handshake.then(parent => {
      console.log('Widget handshake successful');
      this.loadingSettings = false;
      if (!this.affiliateUsername) this.emitWidget();
    }).catch(err => {
      console.error('Widget handshake failed:', err);
      this.loadingSettings = false;
      this.settingsError = `Failed to load settings: ${err.message}.`;
    });
    setTimeout(() => {
      if (this.loadingSettings) {
        console.error('Widget handshake timeout');
        this.loadingSettings = false;
        this.settingsError = 'Connection timed out. Please try again.';
      }
    }, 10000);

    // Listen for messages from iframe and OAuth server
    window.addEventListener('message', (e) => {
      if (e.data.type === 'verifyCredentials') {
        this.verifyCreditMonitoring(e.data.username, e.data.password);
      } else if (e.data.type === 'oauthAccessToken') {
        this.accessToken = e.data.accessToken;
        console.log('Received access token:', this.accessToken);
        this.emitWidget();
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  app.mount('#app');
});