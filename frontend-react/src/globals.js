// Libraries that were loaded via CDN <script> tags are now npm packages, exposed under the same global names.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { Chart, registerables } from 'chart.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

Chart.register(...registerables);
window.firebase = firebase;
window.Chart = Chart;
window.jspdf = { jsPDF };
window.jsPDF = jsPDF;
window.QRCode = QRCode;
window.Html5Qrcode = Html5Qrcode;
window.Html5QrcodeScanner = Html5QrcodeScanner;
window.Html5QrcodeSupportedFormats = Html5QrcodeSupportedFormats;
// Shares top-level functions/consts between the original script files (they used to share the global scope).
window.__expose = (o) => { for (const k in o) { try { window[k] = o[k]; } catch (e) { /* read-only global */ } } };
