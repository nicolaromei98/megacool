// The loader (Webflow head) loads exactly ONE bundle per page: `home` →
// pages/home.js instead of app.js. Importing the app bootstraps the full
// module system so the page behaves like every other.
import "@/app";
