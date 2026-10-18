const fs = require('fs');
const path = require('path');

module.exports = function aboutHeyApi({ version }) {
  const currentYear = new Date().getFullYear();
  let logoBase64 = '';
  try {
    const iconPath = path.join(__dirname, '../about/256x256.png');
    logoBase64 = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
  } catch (e) {}

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1, user-scalable=yes">
        <title>About Hey API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                text-align: center;
                margin: 0;
                padding: 10px;
                background-color: #1a1a2e;
                color: #e0e0e0;
            }
            .logo {
                margin-top: 10px;
            }
            .logo img {
                width: 64px;
                height: 64px;
                border-radius: 14px;
                object-fit: contain;
            }
            .title {
                font-size: 22px;
                margin-top: 8px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: -0.3px;
            }
            .tagline {
                font-size: 11px;
                color: #8888aa;
                margin-top: 4px;
            }
            .version {
                font-size: 12px;
                color: #6c8aff;
                margin-top: 3px;
            }
            .copyright {
                font-size: 13px;
                font-weight: 600;
                color: #7aa2ff;
                margin-top: 8px;
            }
            .footer {
                margin-top: 14px;
                padding: 5px;
                font-size: 11px;
                color: #555577;
                border-top: 1px solid #2a2a4a;
            }
            .attribution {
                font-size: 10px;
                color: #444466;
                margin-top: 4px;
            }
        </style>
    </head>
    <body>
      <div class="logo">
        <img src="${logoBase64}" width="64" height="64" alt="Hey API" />
      </div>
      <h2 class="title">Hey API</h2>
      <div class="tagline">Open-source API development &amp; testing</div>
      <div class="version">v${version}</div>
      <div class="copyright">© ${currentYear} Saket Saurav</div>
      <footer class="footer">
          Hey API Contributors
          <div class="attribution">
            Built upon Bruno (MIT) — Copyright © 2022 Anoop M D, Anusree P S and Contributors
          </div>
      </footer>
    </body>
    </html>
  `;
};
