# Canonical

An open-source collaborative document platform built with Vue.js and Firebase.

## Prerequisites

- Node.js (version 18 or higher)
- npm or yarn
- A Firebase account
- Firebase CLI (`npm install -g firebase-tools`)

## Firebase Setup

This project uses several Firebase services that need to be configured before running locally:

### Required Firebase Services
- **Firestore** - Document database
- **Authentication** - User authentication 
- **Hosting** - Web hosting
- **Cloud Functions** - Server-side functions
- **Analytics** - Usage analytics
- **App Check** - Security with reCAPTCHA

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" 
3. Enter a project name (e.g., "canonical-local")
4. Enable Google Analytics (recommended)
5. Complete the project creation

### 2. Enable Firebase Services

In your Firebase project console:

1. **Authentication**: 
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider

2. **Firestore**:
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (you can tighten security later)
   - Select a location close to you

3. **App Check**:
   - Go to App Check
   - Register your app 
   - Configure reCAPTCHA v3 provider
   - Get your reCAPTCHA site key

### 3. Get Firebase Configuration

1. In your Firebase project, go to Project Settings (gear icon)
2. Scroll down to "Your apps" and click "Add app" 
3. Choose the web app icon (`</>`)
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 4. Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# reCAPTCHA (from App Check setup)
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key

# Optional: Set a default project ID for new users
VITE_DEFAULT_PROJECT_ID=your_project_id
```

Replace all the placeholder values with your actual Firebase configuration values.

### 5. Firebase CLI Setup

1. Install Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Set your project:
   ```bash
   firebase use --add
   ```
   Select your project and give it an alias (e.g., "default")

## Local Development Setup

### 1. Install Dependencies

```bash
# Install main project dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..
```

### 2. Deploy Firestore Rules and Indexes

```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

### 3. Set up Cloud Functions (Optional)

If you want to run Cloud Functions locally:

```bash
# Deploy functions to your Firebase project
firebase deploy --only functions

# Or run functions locally with emulators
firebase emulators:start --only functions,firestore
```

### 4. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Firebase Emulators (Recommended for Development)

For a complete local development experience, use Firebase emulators. This is especially useful for testing invitation flows and user onboarding without affecting production data.

### Initial Emulator Setup

1. **Initialize emulators** (if not already done):
   ```bash
   firebase init emulators
   ```
   Select Auth, Firestore, and UI when prompted.

2. **Configure emulators** - your `firebase.json` should include:
   ```json
   {
     "emulators": {
       "auth": {
         "port": 9099
       },
       "firestore": {
         "port": 8080
       },
       "ui": {
         "enabled": true,
         "port": 4000
       }
     }
   }
   ```

### Running Emulators

```bash
# Start all emulators
firebase emulators:start

# Start with data import/export (preserves data between restarts)
firebase emulators:start --import=./emulator-data --export-on-exit

# Start fresh (no saved data)
firebase emulators:start --import=./emulator-data
```

When using emulators:
- **Firestore UI**: `http://localhost:4000` - View/edit database
- **Your app**: `http://localhost:5173` - Your application
- **Functions**: `http://localhost:5001` - Cloud Functions

### Test User Accounts

After running `npm run seed:invitations`, you'll have access to these test accounts:

#### **New Users (Different Flows)**

1. **Auto-Accept Invitations Flow**
   - **Email**: `newuser@example.com`
   - **Password**: Any password
   - **Behavior**: Will automatically accept 2 pending invitations on signup
   - **Expected Result**: "Welcome! You've been automatically added to 2 projects: Test Project Alpha, Test Project Beta"

2. **Normal New User Flow (No Invitations)**
   - **Email**: `noninvited@example.com`
   - **Password**: Any password
   - **Behavior**: Standard new user flow with no pending invitations
   - **Expected Result**: Redirected to `/new-user` setup flow

3. **Invitation URL Flow**
   - **Email**: `urluser@example.com`
   - **Password**: Any password
   - **Test URL**: `http://localhost:5173/invite/url-invite-token-abc123`
   - **Behavior**: Sign up through invitation link, then accept invitation
   - **Expected Result**: User joins Test Project Alpha after signup

#### **Existing Users**
- **Email**: `admin@example.com` 
  - Role: Project admin for both test projects
  - Has existing default project

- **Email**: `existing@example.com`
  - Role: Existing user with 1 pending invitation (manual acceptance)
  - Will see invitation modal on login

#### **Available Test Projects**
- **Test Project Alpha** - Admin: existing-user-1
- **Test Project Beta** - Admin: existing-user-1

### NPM Scripts
   ```json
   {
     "scripts": {
       "dev": "vite",
       "dev:test": "VITE_USE_EMULATOR=true vite", 
       "emulators": "firebase emulators:start --import=./emulator-data --export-on-exit",
       "emulators:fresh": "firebase emulators:start",
       "seed:invitations": "node scripts/seed-emulator-data.js",
       "seed:clear": "node scripts/seed-emulator-data.js clear"
     }
   }
   ```

### Development Modes

This project supports two development modes:

#### **Production Development** (Real Firebase)
Use this for normal development work with your real Firebase project:
```bash
npm run dev
# → Uses production Firebase services
# → App runs at http://localhost:5173
```

#### **Local Testing** (Emulators)
Use this for testing invitation flows and other features without affecting production:
```bash
# Terminal 1: Start emulators
npm run emulators:fresh

# Terminal 2: Seed test data (wait ~10 seconds for emulators to start)
npm run seed:invitations

# Terminal 3: Start app in emulator mode
npm run dev:test
# → Uses local emulators
# → App runs at http://localhost:5173
```

### Testing Workflow

1. **Start emulator testing environment**:
   ```bash
   # Terminal 1
   npm run emulators:fresh
   
   # Terminal 2 (wait for "All emulators ready" message)
   npm run seed:invitations
   
   # Terminal 3
   npm run dev:test
   ```

2. **Test different new user flows**:
   
   **Auto-Accept Invitations:**
   - Go to `http://localhost:5173`
   - Sign up with: `newuser@example.com`
   - Should see: "Welcome! You've been automatically added to 2 projects" message
   
   **Normal New User (No Invitations):**
   - Sign up with: `noninvited@example.com`
   - Should be redirected to `/new-user` setup flow
   
   **Invitation URL Flow:**
   - Go to: `http://localhost:5173/invite/url-invite-token-abc123`
   - Sign up with: `urluser@example.com`
   - Should auto-accept invitation and join project

3. **Test existing user flow**:
   - Sign in with: `admin@example.com` (admin with projects)
   - Sign in with: `existing@example.com` (pending invitation modal)

4. **Reset and test again**:
   ```bash
   # Kill emulators (Ctrl+C in Terminal 1)
   # Restart with fresh data
   npm run emulators:fresh
   npm run seed:invitations
   ```

5. **Debug with Firestore UI**:
   - Visit `http://localhost:4000`
   - View users, invitations, projects collections
   - Modify test data in real-time

### Testing Different Scenarios

- **Single invitation**: Remove one invitation from seed script
- **No invitations**: Comment out invitation creation in seed script  
- **Expired invitations**: Set `expiresAt` to past date
- **Existing user invitations**: Create invitations for `admin@example.com`

This setup gives you complete control over testing the invitation flow without affecting production data or requiring new user accounts each time.

## Production Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
firebase deploy
```

### Deploy Functions Only
```bash
firebase deploy --only functions
```

## Project Structure

- `src/` - Vue.js application source code
- `functions/` - Firebase Cloud Functions
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore database indexes
- `firebase.json` - Firebase project configuration

## Troubleshooting

### Common Issues

1. **App Check errors**: Make sure you've configured reCAPTCHA v3 and added the site key to your `.env` file

2. **Permission denied errors**: Check that your Firestore rules allow the operations you're trying to perform

3. **Functions not working**: Ensure you've deployed functions and they're properly configured in your Firebase project

4. **Environment variables not loading**: Make sure your `.env` file is in the project root and variables start with `VITE_`

### Getting Help

If you encounter issues:
1. Check the browser console for detailed error messages
2. Review the Firebase console for your project status
3. Ensure all required environment variables are set
4. Verify that all Firebase services are enabled in your project

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with Firebase emulators
5. Submit a pull request

## License

[Add your license information here]
