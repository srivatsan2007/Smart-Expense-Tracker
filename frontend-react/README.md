# Smart Expense Tracker – React frontend

- Dev: `npm install && npm run dev` (backend on :5000; `/api` is proxied)
- Production: from the repo root run `npm run build`, then `npm start` (Express serves `frontend-react/dist`)

Structure: `src/pages` (one component per screen), `src/components` (Layout, Calculator, ChartCanvas),
`src/hooks/useAuth.js` (auth helpers), `src/utils/premiumPdf.js` (PDF report), `src/firebase.js`.
The calculator widget (`src/legacy/calculator.js`) is the only original script still wrapped.
