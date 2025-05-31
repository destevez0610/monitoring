const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse URL-encoded data
app.use(express.urlencoded({ extended: true }));

// Redirect URI route to handle the authorization code
app.get('/oauth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`OAuth Error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  try {
    // Exchange the authorization code for an access token
    const response = await axios.post('https://backend.leadconnectorhq.com/oauth/token', {
      client_id: 'YOUR_CLIENT_ID', // placeholder - Replace with '6835b1cc2f5f6181968df6d6-mbbf0w40'
      client_secret: 'YOUR_CLIENT_SECRET', // placeholder - Replace with '49813065-8625-4e41-99ab-2d7503246b78'
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://your-render-server.onrender.com/oauth/callback' // placeholder - Replace with your Render server URL
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Send the access token back to the widget
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          window.opener.postMessage({
            type: 'oauthAccessToken',
            accessToken: '${access_token}',
            refreshToken: '${refresh_token}',
            expiresIn: ${expires_in}
          }, '*');
          window.close();
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange authorization code for access token');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});