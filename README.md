# Perfectevent4u website + admin panel

## What's new
- FAQ now on the home page (same questions as the Contact page).
- Services section on the home page with a heading, plus a "Services" link in the menu.
- Admin panel at /admin: the owner logs in with a password, uploads photos (several at once, with title, location, category), edits, reorders, deletes, and chooses which show on the home page. Services can be edited there too.
- Portfolio page filters (Weddings / Receptions / Corporate / Celebrations) now work.

- Stand-alone Services page (services.html). It shows the same services you manage in the admin panel, a "Your Journey With Us" section and the FAQ.
- Chatbot on every public page (bottom-right button). It answers common questions about services, booking, pricing, locations, vendors, the founder and contact details, and points people to the contact form when it is unsure. It is rule-based, so there is no AI service, cost or API key. To change its answers, edit the TOPICS list at the top of public/js/chatbot.js. Its contact details are in the CONTACT line at the top of that file.

## Run it
1. Install Node.js 18+.
2. Copy your existing image files (the image/ folder, abi.png, deco1.webp, hall.jpg, wed.jpeg, wed2.webp, etc.) into the public/ folder, next to the HTML files.
3. Copy .env.example to .env and set a long ADMIN_PASSWORD.
4. In this folder run: npm install, then npm start
5. Site: http://localhost:3000 - Admin: http://localhost:3000/admin

## Putting it online
The admin panel needs a small server, so it will not work on plain static hosting (basic shared hosting, GitHub Pages). Use a Node host (Render, Railway, Fly.io, a VPS). Important:
- Set ADMIN_PASSWORD as an environment variable.
- Keep data/ and public/uploads/ on a persistent disk, or uploads and edits are lost on redeploy (override locations with DATA_DIR and UPLOAD_DIR).
- Use HTTPS. Behind a proxy, also set TRUST_PROXY=1.

If the server is unreachable, pages fall back to the built-in photos and services, so nothing breaks.
