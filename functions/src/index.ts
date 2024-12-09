/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest, onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin"; // Changed to double quotes


// Start writing functions
// https://firebase.google.com/docs/functions/typescript

admin.initializeApp();

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const deleteUser = onCall(async (request)=> {
  const userId = request.data.userId;

  try {
    // Delete user document
    await admin.firestore().collection("users").doc(userId).delete();
    // Changed to double quotes

    const userProjectsRef = admin.firestore().collection("userProjects");
    const userProjectsQuery = userProjectsRef.where("userId", "==", userId);
    const userProjectsSnapshot = await userProjectsQuery.get();
    const deleteUserProjectsPromises = userProjectsSnapshot.docs.map(
      (doc) => doc.ref.delete()
    );
    await Promise.all(deleteUserProjectsPromises);

    // Delete associated favorites
    await admin.firestore().collection("favorites").doc(userId).delete();

    // Delete associated tasks
    const tasksRef = admin.firestore().collection("tasks");
    const tasksQuery = tasksRef.where("createdBy", "==", userId);
    const tasksSnapshot = await tasksQuery.get();
    const deleteTaskPromises = tasksSnapshot.docs.map(
      (doc) => doc.ref.delete()
    );
    await Promise.all(deleteTaskPromises);

    return {
      success: true,
      message: "User and associated records deleted successfully."};
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new HttpsError(
        "internal",
        "Unable to delete user records: " + error.message);
    }
    throw new HttpsError(
      "internal",
      "Unable to delete user records: Unknown error");
  }
});
