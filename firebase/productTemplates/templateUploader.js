const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require("firebase/app");

// Load environment variables from .env file
require('dotenv').config();



 // Load environment variables from .env file

const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
  authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FIREBASE_APP_ID,
  measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID
};

// Init app
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(firebaseApp);

// Function to populate templates
async function populateTemplates() {
    const templatesDir = path.join(__dirname); // Use the current directory
    const files = fs.readdirSync(templatesDir);

    for (const file of files) {
        if (path.extname(file) === '.md') {
            const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
            const name = path.basename(file, '.md');

            try {
                await addDoc(collection(db, 'templates'), {
                    content: content,
                    name: name
                });
                console.log(`Uploaded template: ${name}`);
            } catch (error) {
                console.error(`Error uploading template ${name}:`, error);
            }
        }
    }
}

// Execute the function
populateTemplates();