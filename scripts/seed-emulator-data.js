const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
const app = initializeApp({ projectId: 'canonical-dev-b6afd' });
const db = getFirestore(app);
const auth = getAuth(app);

// Wait for emulator to be ready
async function waitForEmulator() {
  const maxRetries = 30; // 30 seconds max wait
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Try to access the emulator
      await db.collection('_test').limit(1).get();
      console.log('✅ Emulator is ready!');
      return;
    } catch (error) {
      if (retries === 0) {
        console.log('⏳ Waiting for emulator to start...');
      }
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('❌ Emulator failed to start within 30 seconds');
}

// Add cleanup function for testing
async function clearTestData() {
  console.log('🧹 Clearing test data...');
  
  try {
    // Wait for emulator to be ready first
    await waitForEmulator();
    
    // Clear Firestore data
    const collections = ['users', 'project', 'invitations', 'userProjects', 'documents', 'tasks', 'chats', 'favorites'];
  
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    }
    
    // Clear Firebase Auth users using curl command (most reliable for emulator)
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('curl -X DELETE "http://localhost:9099/emulator/v1/project/canonical-dev-b6afd/accounts"');
      console.log('✅ Cleared all auth users via REST API');
    } catch (authError) {
      // Fallback to admin SDK method
      try {
        const listUsers = await auth.listUsers();
        const deletePromises = listUsers.users.map(user => auth.deleteUser(user.uid));
        await Promise.all(deletePromises);
        console.log(`✅ Cleared ${listUsers.users.length} auth users via admin SDK`);
      } catch (fallbackError) {
        console.log('ℹ️  No auth users to clear or auth emulator not available');
      }
    }
    
    console.log('✅ Test data cleared!');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
}

async function createAuthUsers() {
  console.log('👥 Creating Firebase Auth users...');
  
  const defaultPassword = 'testPassword123!'; // Consistent test password
  
  const testUsers = [
    {
      uid: 'existing-user-1',
      email: 'admin@example.com',
      displayName: 'Project Admin',
      password: defaultPassword
    },
    {
      uid: 'existing-user-2', 
      email: 'existing@example.com',
      displayName: 'Existing User',
      password: defaultPassword
    }
  ];

  for (const user of testUsers) {
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        password: user.password,
        emailVerified: true // Skip email verification for testing
      });
      console.log(`✅ Created auth user: ${user.email}`);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log(`ℹ️  Auth user already exists: ${user.email}`);
      } else {
        throw error;
      }
    }
  }
  
  return defaultPassword;
}

async function seedInvitationTestData() {
  console.log('🌱 Seeding invitation test data...');

  try {
    // Wait for emulator to be ready first
    await waitForEmulator();
    
    // Always clear data first to avoid conflicts
    await clearTestData();
    console.log('🌱 Starting fresh with clean data...');
    
    // Create Firebase Auth users first
    const defaultPassword = await createAuthUsers();
    
    // Test projects
    await db.collection('project').doc('test-project-1').set({
      name: 'Test Project Alpha',
      folders: [
        { name: 'Getting Started', children: [], isOpen: true },
        { name: 'Product Docs', children: [], isOpen: true }
      ],
      createdBy: 'existing-user-1',
      users: ['existing-user-1']
    });

    await db.collection('project').doc('test-project-2').set({
      name: 'Test Project Beta',
      folders: [
        { name: 'Engineering', children: [], isOpen: true }
      ],
      createdBy: 'existing-user-1',
      users: ['existing-user-1']
    });

    // Existing user (project admin)
    await db.collection('users').doc('existing-user-1').set({
      email: 'admin@example.com',
      displayName: 'Project Admin',
      createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      defaultProject: 'test-project-1',
      tier: 'pro',
    });

    // User project associations
    await db.collection('userProjects').doc('up-1').set({
      userId: 'existing-user-1',
      projectId: 'test-project-1',
      role: 'admin',
      status: 'active',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    await db.collection('userProjects').doc('up-2').set({
      userId: 'existing-user-1',
      projectId: 'test-project-2',
      role: 'admin',
      status: 'active',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    // Pending invitations for new user (these will be auto-accepted)
    await db.collection('invitations').doc('invite-1').set({
      email: 'autoaccept@example.com',
      projectId: 'test-project-1',
      projectName: 'Test Project Alpha',
      role: 'user',
      status: 'pending',
      inviteToken: 'test-token-123',
      invitedBy: 'existing-user-1',
      inviterName: 'Project Admin',
      createdDate: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    // Additional invitation for multi-project testing
    await db.collection('invitations').doc('invite-2').set({
      email: 'autoaccept@example.com',
      projectId: 'test-project-2',
      projectName: 'Test Project Beta',
      role: 'admin',
      status: 'pending',
      inviteToken: 'test-token-456',
      invitedBy: 'existing-user-1',
      inviterName: 'Project Admin',
      createdDate: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Manual invitation for existing user (to test existing user flow)
    await db.collection('invitations').doc('invite-3').set({
      email: 'existing@example.com',
      projectId: 'test-project-1',
      projectName: 'Test Project Alpha',
      role: 'user',
      status: 'pending',
      inviteToken: 'test-token-789',
      invitedBy: 'existing-user-1',
      inviterName: 'Project Admin',
      createdDate: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Existing user without default project (to test existing user manual flow)
    await db.collection('users').doc('existing-user-2').set({
      email: 'existing@example.com',
      displayName: 'Existing User',
      createdDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      defaultProject: null, // No default project
      tier: 'trial',
    });

    // Invitation for URL-based signup (test invitation link flow)
    await db.collection('invitations').doc('invite-url-test').set({
      email: 'urluser@example.com',
      projectId: 'test-project-1',
      projectName: 'Test Project Alpha',
      role: 'user',
      status: 'pending',
      inviteToken: 'url-invite-token-abc123',
      invitedBy: 'existing-user-1',
      inviterName: 'Project Admin',
      createdDate: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log('✅ Invitation test data seeded successfully!');
    console.log('');
    console.log('🔐 Test user credentials (Password: ' + defaultPassword + '):');
    console.log('   - admin@example.com (project admin with existing projects)');
    console.log('   - existing@example.com (existing user with 1 pending invitation)');
    console.log('');
    console.log('📧 Test user accounts for signup:');
    console.log('   - autoaccept@example.com (NEW USER - will auto-accept 2 invitations)');
    console.log('   - noninvited@example.com (NEW USER - no invitations, normal flow)');
    console.log('   - urluser@example.com (NEW USER - via invitation URL)');
    console.log('');
    console.log('🔗 Test invitation tokens:');
    console.log('   - test-token-123 (Alpha project, user role)');
    console.log('   - test-token-456 (Beta project, admin role)');
    console.log('   - test-token-789 (Alpha project for existing user)');
    console.log('   - url-invite-token-abc123 (URL invitation for urluser@example.com)');
    console.log('');
    console.log('🌐 Invitation URL test:');
    console.log('   http://localhost:5173/invite/url-invite-token-abc123');
    console.log('');
    console.log('🌐 Emulator UI: http://localhost:4000');
    console.log('🚀 Your app: http://localhost:5173');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'clear') {
  clearTestData().catch(console.error);
} else {
  seedInvitationTestData().catch(console.error);
} 