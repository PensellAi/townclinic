import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const CFG = self.TC_CONFIG || { firebase: {} };
export const configured = !!CFG.firebase.apiKey && !String(CFG.firebase.apiKey).startsWith("PASTE");
export const app = configured ? initializeApp(CFG.firebase) : null;
export const db = app ? getFirestore(app) : null;
export const phoneToEmail = (p) => p + "@" + (CFG.loginDomain || "townclinic.app");
