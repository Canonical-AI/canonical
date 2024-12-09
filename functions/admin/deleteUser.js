
// run me with node functions/admin/deleteUser.js <user-id

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const dotenv = require('dotenv');

dotenv.config();

const app = initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    // Add other necessary configuration options here
});
const functions = getFunctions(app);

const userIdToDelete = process.argv[2];

if (!userIdToDelete) {
  console.error('Please provide a user ID to delete.');
  process.exit(1);
}

console.log(`Deleting user with ID: ${userIdToDelete}`);

const deleteUser = httpsCallable(functions, 'deleteUser');
deleteUser({ userId: userIdToDelete })
  .then((result) => {
    // Handle the result of the Cloud Function
    const data = result.data;
    console.log('User deletion successful:', data.message);
  })
  .catch((error) => {
    // Handle any errors
    console.error('Error deleting user:', error.message);
  });


