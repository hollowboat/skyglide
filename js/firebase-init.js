// ============ FIREBASE INIT ============
// Using the "compat" SDK loaded via <script> tags in index.html so this
// works directly from a static host (GitHub Pages / Firebase Hosting)
// with no bundler required.

const firebaseConfig = {
  apiKey: "AIzaSyAPVoqCQyb6iY8STCZ6VBCkVo8MMFO8s7I",
  authDomain: "hollowboat-47609.firebaseapp.com",
  databaseURL: "https://hollowboat-47609-default-rtdb.firebaseio.com",
  projectId: "hollowboat-47609",
  storageBucket: "hollowboat-47609.firebasestorage.app",
  messagingSenderId: "395550245666",
  appId: "1:395550245666:web:d57e8c6a8c5e3264b61b7b",
  measurementId: "G-EYKJ68YW6T"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const functionsClient = firebase.functions();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Callable references — these are the ONLY way score/coins/skins get
// written server-side now. The client never writes to /users or
// /leaderboard directly (see database.rules.json — those paths are
// locked to ".write": false for everyone except the Admin SDK).
const callStartRun = functionsClient.httpsCallable("startRun");
const callSubmitScore = functionsClient.httpsCallable("submitScore");
const callUnlockSkin = functionsClient.httpsCallable("unlockSkin");
const callMergeGuestProgress = functionsClient.httpsCallable("mergeGuestProgress");
