import {firebaseApp} from "../firebase";
import { getFirestore, collection, query, where, setDoc, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, increment } from "firebase/firestore";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import router from "../router";
import store from "../store";
import _ from 'lodash';
 // Load environment variables from .env file

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(firebaseApp)
export default db;

export const collectionMap = {
  user:'users',
  comment:'comments',
  approval:'approvals',
  document:'documents',
  change:'documentChanges',
  template:'templates',
  favorites:'favorites',
  project:'projects',
  task:'tasks',
}


function checkUserLoggedIn() {
  if (!store.state.user.uid) {
    store.commit('alert', { type: 'error', message: 'Cannot proceed: not logged in', autoClear: true });
    throw new Error('Cannot proceed: not logged in');
  }
  return true
}

function withTimeout(fn, timeoutDuration) {
  return async function(...args) {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutDuration)
    );

    try {
      return await Promise.race([fn.apply(this, args), timeoutPromise]);
    } catch (error) {
      // Commit an alert to the store when a timeout occurs
      store.commit('alert', { type: 'error', message: error.message, autoClear: true });
      throw error; // Re-throw the error after committing the alert
    }
  };
}


// Higher-order function to wrap all async methods in a class
function wrapAsyncMethodsWithTimeout(targetClass, timeoutDuration) {
  // Wrap instance methods
  const instanceMethodNames = Object.getOwnPropertyNames(targetClass.prototype).filter(
    method => typeof targetClass.prototype[method] === 'function' && method !== 'constructor'
  );

  instanceMethodNames.forEach(method => {
    const originalMethod = targetClass.prototype[method];
    targetClass.prototype[method] = withTimeout(originalMethod, timeoutDuration);
  });

  // Wrap static methods
  const staticMethodNames = Object.getOwnPropertyNames(targetClass).filter(
    method => typeof targetClass[method] === 'function' && method !== 'constructor'
  );

  staticMethodNames.forEach(method => {
    const originalMethod = targetClass[method];
    targetClass[method] = withTimeout(originalMethod, timeoutDuration);
  });
}

export function addInDefaults(value) {
  checkUserLoggedIn()
  value.createdBy = value.createdBy || store.state.user.uid;
  value.updatedBy = store.state.user.uid;
  value.project = value.project || store.state.project.id;
  value.createDate = value.createDate || serverTimestamp();
  value.updatedDate = serverTimestamp(); // Add this line
  value.archived = false;
  return value;
}

// users
export class User{
  constructor(value) {
    this.displayName = value.displayName || "";
    this.email = value.email || "";
    this.defaultProject = value.defaultProject || null;
    this.org = value.org || store.state.user.email.split('@')[1];
    this.tier = value.tier || 'free';
    this.createDate =  serverTimestamp();
    this.updatedDate = serverTimestamp(); // Add this line
    this.archived = false;
  }

  static async getUserData(id){
    const userRef = doc(db, "users", id);
    const userDoc = await getDoc(userRef);
    const userProjects = await this.getProjectsForUser(id)
    
    return { id: userDoc.id, ...userDoc.data() , projects: userProjects };
  }
  
  static async getUserAuth() {
    const auth = getAuth(firebaseApp);

    return new Promise((resolve, reject) => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          console.log('user not logged in');
          router.push('/register')
          return resolve(null);
        }

        const userRef = doc(db, "users", user.uid);
        const userDetails = await this.getUserData(userRef.id);

        if (!userDetails || !userDetails.email) {
          await this.createUser(user);
          return resolve(null);
        }

        if (!userDetails.defaultProject) {
          router.push('/new-user');
          return resolve(userDetails);
        }

        resolve(userDetails);
      });
    });
  }

  static async logout(){
    const auth = getAuth();
    await signOut(auth);
    store.commit('logout')
    store.commit('alert',{type:'info',message:'logged out',autoClear:true})
  }
  
  static async createUser(payload){
    router.push('/new-user');  /// step 1 push to /new-user will keep loading till...

    const newUser = {
      displayName: payload.email,
      email: payload.email,
      defaultProject: null,
      tier: 'pro',
      createdDate: serverTimestamp(),
    };

    await setDoc(doc(db, "users", payload.uid), newUser);

    const userDataForStore = { ...newUser, id: payload.uid};
    await store.commit('setUserData', userDataForStore); // step 2 /new-user will stop loading once we check that we have uid in state

    store.commit('alert', { type: 'info', message: 'New User Account Created!' });
    // user will then be forced to setup their project. 
   return
  }

  static async setDefaultProject(id, value) {
    checkUserLoggedIn()
    const userRef = doc(db, "users", id);
    await updateDoc(userRef, { defaultProject: value });
  }

   // USER PROJECTS
  static async addUserToProject(userId, projectId, role='user') {
    checkUserLoggedIn()
    // todo check if current user is admin of project
    const userProjectRef = collection(db, "userProjects");
    await addDoc(userProjectRef, { userId, projectId, role });
    store.commit('alert', { type: 'info', message: 'User added to project', autoClear: true });
  }

  static async getProjectsForUser(userId) {
    const userProjectsRef = collection(db, "userProjects");
    const q = query(userProjectsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().projectId);
  }

  static async updatefield(id, field, value) {
    checkUserLoggedIn()
    const userRef = doc(db, "users", id);
    await updateDoc(userRef, {[field]: value});
  }

  
  //danger will delete user and project associations (and comments, chats ect eventually) will not delete docs or projects
  // static async deleteUser(userId) {
  //   const userRef = doc(db, "users", userId);
  //   await deleteDoc(userRef);
  // }
}

export class Project {
  constructor(value) {
    this.name = value.name || ""; // String
    this.createdBy = value.createdBy || store.state.user.uid;
    this.folders = value.folders || [];
    this.org = value.org || store.state.user.email.split('@')[1];
    Object.assign(this, addInDefaults(this));
  }
  
  static async create(value) {
    checkUserLoggedIn()
    const projectInstance = new Project(value);
    const docRef = await addDoc(collection(db, "project"), {...projectInstance});
    await this.addUserToProject(store.state.user.uid, docRef.id, 'admin')
    store.commit('alert', {type: 'info', message: `Project added`, autoClear: true});
    return docRef;
  }
  
  static async getById(id, userDetails = false) {
    const projectRef = doc(db, "project", id);
    const snapshot = await getDoc(projectRef);
    let users = []
    if (store.state.user.uid) {
      users = await this.getUsersForProject(id, userDetails);
    } 
    return {
      id: snapshot.id,
      ...snapshot.data(),
      users: users
    };
  }
  
  static async update(id, value) {
    checkUserLoggedIn()
    const projectRef = doc(db, "project", id);
    await updateDoc(projectRef, value);
  }

  
  static async updatefield(id, field, value) {
    checkUserLoggedIn()
    const documentRef = doc(db, "project", id);
    await updateDoc(documentRef, {[field]: value});
    await updateDoc(documentRef, {updatedDate: serverTimestamp()});
  }

  static async archive(id) {
    checkUserLoggedIn()
    const projectRef = doc(db, "project", id);
    await updateDoc(projectRef, { archived: true });
    store.commit('alert', {type: 'info', message: `Project archived`, autoClear: true});
  }

  static async delete(id) {
    checkUserLoggedIn()
    const projectRef = doc(db, "project", id);
    await updateDoc(projectRef, { archived: true });
    store.commit('alert', {type: 'info', message: `Project archived`, autoClear: true});
  }

  // USER PROJECTS 
  static async addUserToProject(userId, projectId, role='user') {
      // todo check if current user is admin of project
    checkUserLoggedIn();
    const userProjectRef = collection(db, "userProjects");
    await addDoc(userProjectRef, { userId, projectId, role});
    store.commit('alert', { type: 'info', message: 'User added to project', autoClear: true });
  }

  static async getUsersForProject(projectId, details = false) {
    checkUserLoggedIn();
    //probably need to check if user in project
    const userProjectsRef = collection(db, "userProjects");
    const q = query(userProjectsRef, where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({
      userId: doc.data().userId,
      role: doc.data().role
    }));

    if (details) {
      const userIds = users.map(u => u.userId);
      const userIdChunks = _.chunk(userIds, 10); // need to chunk to avoid limit of 10 items in firebase query
      
      let usersDetail = [];
      for (const chunk of userIdChunks) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where('__name__', 'in', chunk));
        const userSnapshots = await getDocs(q);
        
        const chunkUsers = userSnapshots.docs.map(doc => {
          const role = users.find(u => u.userId === doc.id)?.role;
          return { 
            id: doc.id, 
            ...doc.data(), 
            role,
          };
        });
        
        usersDetail.push(...chunkUsers);
      }
      
      return usersDetail;
    }

    return users;
  }

}


export class Comment {
  constructor(value) {
    this.comment = value.comment; 
    Object.assign(this, addInDefaults(this));
  }
}

export class Document {
  constructor(value) {
    this.defaultValues = {
      archived: value.archived || false,
      content: value.content || "",
      name: value.name || "",
      id: value.id || "",
      draft: value.draft || true,
      children: value.children || [],
      order: value.order || 1000,
      version: value.version || [],
    }

  }
  
  static async getAll(includeArchived = false, includeDraft = false) {
    'getting documents'
    const documentsRef = collection(db, "documents");

    const conditions = [
      where("project", "==", store.state.project.id)
    ];

    if (!includeArchived) {
      conditions.push(where("archived", "==", false));
    }

    if (!store.state.user.uid && !includeDraft) {
      conditions.push(where("draft", "==", false));
    }

    const q = query(documentsRef, ...conditions);

    const snapshot = await getDocs(q);
    const documents = await Promise.all(snapshot.docs.map(async(doc) => ({
      id: doc.id,
      data: doc.data()
    })));

    return documents;
  }

  
  static async getDocById(id) {
    // todo get if user in project
    const documentRef = doc(db, "documents", id);
    const snapshot = await getDoc(documentRef);

    const versionsRef = collection(documentRef, "versions");
    const versionsSnapshot =  await getDocs(versionsRef);

    const commentsRef = collection(documentRef, "comments");
    const commentsSnapshot = await getDocs(commentsRef);

    return {
      id: snapshot.id,
      data: snapshot.data(),
      versions: versionsSnapshot.docs.map(doc => ({
          id: doc.id, 
          ...doc.data()
        })),
      comments: commentsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))
    }
  }
  
  static async create(value) {
    checkUserLoggedIn()

    const doc = new Document(value)
    const newDoc = addInDefaults(doc.defaultValues);
    
    const docRef = await addDoc(collection(db, "documents"), newDoc);
    store.commit('alert', {type: 'info', message: `document added`, autoClear: true});

    return docRef;
  }

  
  static async updateDoc(id, value) {
    checkUserLoggedIn()

    const docData = addInDefaults(value); // Add defaults including serverTimestamp()
    const documentRef = doc(db, "documents", id);
    await updateDoc(documentRef, docData);
    store.commit('alert', {type: 'info', message: `document updated`, autoClear: true});
  }

  
  static async updateDocField(id, field, value) {
    checkUserLoggedIn()
    const documentRef = doc(db, "documents", id);
    await updateDoc(documentRef, {[field]: value});
    store.commit('alert', {type: 'info', message: `document updated`, autoClear: true});
    return await updateDoc(documentRef, {updatedDate: serverTimestamp()});
  }

  
  static async archiveDoc(id) {
    checkUserLoggedIn()
    const documentRef = doc(db, "documents", id);
    await updateDoc(documentRef, {archived: true});
    store.commit('alert', {type: 'info', message: `document archived`, autoClear: true});
  }

  
  static async deleteDocByID(id) {
    checkUserLoggedIn()
    const documentRef = doc(db, "documents", id);
    await deleteDoc(documentRef);
    store.commit('alert', {type: 'info', message: `document deleted`, autoClear: true});
  }


  ///-----------------------------------
  /// DOC Comments
  ///-----------------------------------  
  
  static async createComment(docID, comment) {
    checkUserLoggedIn();
    const documentRef = doc(db, "documents", docID);
    
    const commentInstance = new Comment(comment);
    
    const commentRef = await addDoc(collection(documentRef, "comments"), {...commentInstance});
    console.log('comment created')
    return {id: commentRef.id, ...commentInstance};
  }

  static async updateComment(docID, id, comment) {
    checkUserLoggedIn();
    const documentRef = doc(db, "documents", docID);
    const commentRef = doc(documentRef, "comments", id);
    await updateDoc(commentRef, {updatedDate: serverTimestamp(), comment: comment});
    console.log('comment updated')
  } 

  static async archiveComment(docID, id) {
    checkUserLoggedIn();
    const documentRef = doc(db, "documents", docID);
    const commentRef = doc(documentRef, "comments", id);
    await updateDoc(commentRef, {archived: true});
  }

  static async deleteComment(docID, id) {
    checkUserLoggedIn();
    const documentRef = doc(db, "documents", docID);
    const commentRef = doc(documentRef, "comments", id);
    await deleteDoc(commentRef);
    console.log('comment deleted')
  }

  ///-----------------------------------
  /// DOC VERSIONS
  ///-----------------------------------  
  static async getDocVersion(docID, versionNumber){
    console.log('getDocVersion', docID, versionNumber)
    const documentRef = doc(db, "documents", docID);
    const versionsRef = collection(documentRef, "versions");
    const q = query(versionsRef, where("versionNumber", "==", versionNumber));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id, 
        ...doc.data()}))[0];
  }

  
  static async createVersion(docId, versionContent, versionNumber) {
    checkUserLoggedIn();

    // Get the current document
    const documentRef = doc(db, "documents", docId);

    // Need to check to make sure version number is unique
    const versionsRef = collection(documentRef, "versions");
    const versionsSnapshot = await getDocs(versionsRef);
    const existingVersionNumbers = versionsSnapshot.docs.map(doc => doc.data().versionNumber);

    if (existingVersionNumbers.includes(versionNumber)) {
      store.commit('alert', { type: 'info', message: `Version ${versionNumber} already exists`, autoClear: true, color: 'error' });
      throw new Error(`Version number ${versionNumber} already exists for this document.`);
    }

    // Create a new version
    const newVersion = {
      content: versionContent,
      createdBy: store.state.user.uid,
      createDate: serverTimestamp(),
      versionNumber: versionNumber
    };

    // Add the new version to the versions subcollection
    const versionRef = await addDoc(collection(documentRef, "versions"), newVersion);

    store.commit('alert', { type: 'info', message: `Version ${newVersion.versionNumber} created`, autoClear: true });
    return versionRef;
  }

  
  static async deleteVersion(docId, versionNumber) {
    checkUserLoggedIn();

    const documentRef = doc(db, "documents", docId);
    const versionsRef = collection(documentRef, "versions");
    const q = query(versionsRef, where("versionNumber", "==", versionNumber));
    const versionSnapshot = await getDocs(q);
    if (!versionSnapshot.empty) {
        const versionDocRef = versionSnapshot.docs[0].ref; // Get the reference of the first matching version
        await deleteDoc(versionDocRef); // Delete the specific version document
        store.commit('alert', {type: 'info', message: `doc version deleted`, autoClear: true});
    } else {
        store.commit('alert', {type: 'error', message: `Version not found`, autoClear: true});
    }

  } 
}

export class Template {
  constructor(value) {
    this.name = value.name; // String
    this.content = value.content; // HTML
  }

  static async getAll() {
    const templatesRef = collection(db, "templates");
    const snapshot = await getDocs(templatesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

export class ChatHistory {
  constructor(value) {
    this.messages = [];
    this.name = value.name || "";
    this.updatedDate = serverTimestamp();
    // Call addInDefaults to add any missing default fields
    Object.assign(this, addInDefaults(this));
  }

  
  static async create(value) {
    checkUserLoggedIn()
    value = addInDefaults(value);
    const docRef = await addDoc(collection(db, "chats"), value);
    store.commit('alert', {type: 'info', message: `document added`, autoClear: true});
    return docRef;
  }
  
  static async getAll() {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef,
      where("archived", "==", false),
      where("createdBy", "==", store.state.user.uid)
    );
    const snapshot = await getDocs(q);

    const chats = await Promise.all(snapshot.docs.map(async(doc) => ({
      id: doc.id,
      data: doc.data()
    })));

    return chats;
  }

  
  static async getDocById(id) {
    checkUserLoggedIn()
    const documentRef = doc(db, "chats", id);
    const snapshot = await getDoc(documentRef);
    return {
      id: snapshot.id,
      data: snapshot.data()
    };
  }

  
  static async updateChat(id, value) {
    checkUserLoggedIn()
    const documentRef = doc(db, "chats", id);
    await updateDoc(documentRef, value);
    return await updateDoc(documentRef, {updatedDate: serverTimestamp()});
  }

  static async updateChatField(id, field, value) {
    checkUserLoggedIn()
    const documentRef = doc(db, "chats", id);
    await updateDoc(documentRef, {[field]: value});
    await updateDoc(documentRef, {updatedDate: serverTimestamp()});
  }

  
  static async archiveChat(id) {
    checkUserLoggedIn()
    const documentRef = doc(db, "chats", id);
    await updateDoc(documentRef, {archived: true});
    store.commit('alert', {type: 'info', message: `chat archived`, autoClear: true});
  }

  
  static async deleteChat(id) {
    checkUserLoggedIn()
    const documentRef = doc(db, "chats", id);
    await deleteDoc(documentRef);
    store.commit('alert', {type: 'info', message: `chat deleted`, autoClear: true});
  }
}

export class UsageLogger {

  
  static async logUsage(userId, functionName) {
      const usageRef = doc(db, "usageLogs", userId);
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

      const usageDoc = await getDoc(usageRef);
      if (usageDoc.exists()) {
          const data = usageDoc.data();
          if (data[functionName] && data[functionName][today]) {
              await updateDoc(usageRef, {
                  [`${functionName}.${today}`]: increment(1)
              });
          } else {
              await updateDoc(usageRef, {
                  [`${functionName}.${today}`]: 1
              });
          }
      } else {
          await setDoc(usageRef, {
              [functionName]: {
                  [today]: 1
              }
          });
      }
  }
}

export class Favorites {

  static async getAll() {
    checkUserLoggedIn()
    const favoritesRef = doc(db, "favorites", store.state.user.uid);
    const snapshot = await getDoc(favoritesRef);
    if (snapshot.exists() && snapshot.data().createdBy === store.state.user.uid) { // Check if created by logged-in user
      return snapshot.data().documentIds || [];
    } else {
      return [];
    }
  }
  
  static async updateFavorites(favorites) {
    checkUserLoggedIn()
    const favoritesRef = doc(db, "favorites", store.state.user.uid);
    const data = addInDefaults({ documentIds: favorites });
    await setDoc(favoritesRef, data, { merge: true });
    store.commit('alert', { type: 'info', message: 'Favorites updated', autoClear: true });
  }
}

export class Task {
  static async getAll() {
    checkUserLoggedIn()
    const tasksRef = collection(db, "tasks");
    const q = query(tasksRef, where("project", "==", store.state.project.id));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  static async updateTasks(docID, documentContent) {
    checkUserLoggedIn()
    const tasksRef = doc(db, "tasks", docID);
    const snapshot = await getDoc(tasksRef);

    //remove the record if there are no tasks but there were tasks before
    if (!documentContent.content) {
      await deleteDoc(tasksRef);
      return;
    };
      
    const taskRegex = /:canonical-task{src="([^"]*)" identity="([^"]*)" checked="([^"]*)"}/g;
    const matches = [...documentContent.content.matchAll(taskRegex)];
    const tasks = matches.map(match => ({
        src: match[1],
        identity: match[2],
        checked: match[3] === 'true',
    }));


    let updatedTasks = [];
    for (const task of tasks) {
      const storedTask = snapshot?.data()?.tasks?.find(t => t.identity=== task.identity);


      if (storedTask) {
        updatedTasks.push({
            ...task, 
            priority: storedTask?.priority || null,
            createdDate: storedTask?.createdDate || null,
            checkDate: task.checked ? 
              (!storedTask.checked ? { seconds: Math.floor(Date.now() / 1000) } : storedTask.checkDate) : 
              null
          })

      } else {
       updatedTasks.push({
        ...task,
        createdDate: { seconds: Math.floor(Date.now() / 1000) },
        checkDate: task.checked ? { seconds: Math.floor(Date.now() / 1000) } : null
       })
      }
    }

    const data = addInDefaults({
      docID: docID,
      createdBy: store.state.user.uid,
      tasks: updatedTasks
    });


  await setDoc(tasksRef, data, { merge: true });
  return data
  }


  static async updateTask(docID, identity, value) {
    checkUserLoggedIn()
    console.log('updating task', docID, identity)
    const tasksRef = doc(db, "tasks", docID);
    const snapshot = await getDoc(tasksRef);
    
    if (!snapshot.exists()) {
      throw new Error('Task document not found');
    }

    const tasks = snapshot.data().tasks;
    const taskIndex = tasks.findIndex(task => task.identity === identity);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    // Create a new tasks array with the updated task
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...value };

    await updateDoc(tasksRef, { 
      tasks: updatedTasks,
      updatedDate: serverTimestamp()
    });
  }


}

wrapAsyncMethodsWithTimeout(User, 5000); // 5 seconds timeout
wrapAsyncMethodsWithTimeout(Comment, 5000);
wrapAsyncMethodsWithTimeout(Document, 5000);
wrapAsyncMethodsWithTimeout(Template, 5000);
wrapAsyncMethodsWithTimeout(ChatHistory, 5000);
wrapAsyncMethodsWithTimeout(UsageLogger, 5000);
wrapAsyncMethodsWithTimeout(Favorites, 5000);
wrapAsyncMethodsWithTimeout(Project, 5000);




