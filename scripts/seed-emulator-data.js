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

    // Test documents for migration scenarios
    console.log('📄 Creating migration test documents...');
    
    // Document 1: Has versions that NEED migration (no corresponding commits)
    await db.collection('documents').doc('doc-needs-migration').set({
      name: 'Document Needs Migration',
      type: 'markdown',
      content: '# Current Content\n\nThis document has versions that need migration.',
      project: 'test-project-1',
      createdBy: 'existing-user-1',
      archived: false,
      createdDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      releasedVersion: ['1.0.0', '1.1.0'], // This indicates versions exist
      folder: 'Getting Started',
    });

    // Create versions subcollection for doc-needs-migration
    await db.collection('documents').doc('doc-needs-migration').collection('versions').add({
      versionNumber: '1.0.0',
      content: '# Version 1.0.0\n\nInitial release content.',
      released: true,
      createDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-needs-migration').collection('versions').add({
      versionNumber: '1.1.0',
      content: '# Version 1.1.0\n\nUpdated content with new features.',
      released: true,
      createDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    // Document 2: Has versions that have ALREADY been migrated (has corresponding commits)
    await db.collection('documents').doc('doc-already-migrated').set({
      name: 'Document Already Migrated',
      type: 'markdown', 
      content: '# Current Content\n\nThis document has already been migrated.',
      project: 'test-project-1',
      createdBy: 'existing-user-1',
      archived: false,
      createdDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      releasedVersion: ['2.0.0', '2.1.0'], // This indicates versions exist
      folder: 'Product Docs',
    });

    // Create versions subcollection for doc-already-migrated
    await db.collection('documents').doc('doc-already-migrated').collection('versions').add({
      versionNumber: '2.0.0',
      content: '# Version 2.0.0\n\nMajor release with breaking changes.',
      released: true,
      createDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-already-migrated').collection('versions').add({
      versionNumber: '2.1.0',
      content: '# Version 2.1.0\n\nBug fixes and improvements.',
      released: true,
      createDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    // Create commits subcollection for doc-already-migrated (matching versions)
    await db.collection('documents').doc('doc-already-migrated').collection('commits').add({
      message: 'Migrated from version 2.0.0',
      parentCommitId: null,
      content: '# Version 2.0.0\n\nMajor release with breaking changes.',
      versionNumber: '2.0.0', // This matches the version - indicates migration complete
      branch: 'main',
      released: true,
      tags: [],
      archived: false,
      createDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      project: 'test-project-1'
    });

    await db.collection('documents').doc('doc-already-migrated').collection('commits').add({
      message: 'Migrated from version 2.1.0',
      parentCommitId: null,
      content: '# Version 2.1.0\n\nBug fixes and improvements.',
      versionNumber: '2.1.0', // This matches the version - indicates migration complete
      branch: 'main',
      released: true,
      tags: [],
      archived: false,
      createDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      project: 'test-project-1'
    });

    // Document 3: Mixed scenario - some versions migrated, some not
    await db.collection('documents').doc('doc-partial-migration').set({
      name: 'Document Partial Migration',
      type: 'markdown',
      content: '# Current Content\n\nThis document has partial migration.',
      project: 'test-project-1', 
      createdBy: 'existing-user-1',
      archived: false,
      createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      releasedVersion: ['3.0.0', '3.1.0', '3.2.0'],
      folder: 'Product Docs',
    });

    // Create versions subcollection for doc-partial-migration
    await db.collection('documents').doc('doc-partial-migration').collection('versions').add({
      versionNumber: '3.0.0',
      content: '# Version 3.0.0\n\nBaseline version.',
      released: true,
      createDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-partial-migration').collection('versions').add({
      versionNumber: '3.1.0',
      content: '# Version 3.1.0\n\nMinor updates.',
      released: true,
      createDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-partial-migration').collection('versions').add({
      versionNumber: '3.2.0',
      content: '# Version 3.2.0\n\nLatest improvements.',
      released: true,
      createDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    // Create commits subcollection for doc-partial-migration (only first two versions)
    await db.collection('documents').doc('doc-partial-migration').collection('commits').add({
      message: 'Migrated from version 3.0.0',
      parentCommitId: null,
      content: '# Version 3.0.0\n\nBaseline version.',
      versionNumber: '3.0.0',
      branch: 'main',
      released: true,
      tags: [],
      archived: false,
      createDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      project: 'test-project-1'
    });

    await db.collection('documents').doc('doc-partial-migration').collection('commits').add({
      message: 'Migrated from version 3.1.0',
      parentCommitId: null,
      content: '# Version 3.1.0\n\nMinor updates.',
      versionNumber: '3.1.0',
      branch: 'main',
      released: true,
      tags: [],
      archived: false,
      createDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      project: 'test-project-1'
    });
    // Missing commit for 3.2.0 - this should trigger migration

    // Document 4: No versions at all (should be ignored by migration)
    await db.collection('documents').doc('doc-no-versions').set({
      name: 'Document No Versions',
      type: 'markdown',
      content: '# New Document\n\nThis document has no versions.',
      project: 'test-project-1',
      createdBy: 'existing-user-1', 
      archived: false,
      createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      releasedVersion: [], // No versions
      folder: 'Getting Started',
    });

    // Document 5: Document with unreleased versions
    await db.collection('documents').doc('doc-unreleased-versions').set({
      name: 'Document with Unreleased Versions',
      type: 'markdown',
      content: '# Current Content\n\nThis document has unreleased versions.',
      project: 'test-project-1',
      createdBy: 'existing-user-1',
      archived: false,
      createdDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      releasedVersion: ['4.0.0'], // Only one released version
      folder: 'Product Docs',
    });

    // Create versions subcollection for doc-unreleased-versions
    await db.collection('documents').doc('doc-unreleased-versions').collection('versions').add({
      versionNumber: '4.0.0',
      content: '# Version 4.0.0\n\nFirst stable release.',
      released: true,
      createDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-unreleased-versions').collection('versions').add({
      versionNumber: '4.1.0-beta',
      content: '# Version 4.1.0-beta\n\nBeta version with experimental features.',
      released: false, // This version is NOT released
      createDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    await db.collection('documents').doc('doc-unreleased-versions').collection('versions').add({
      versionNumber: '4.2.0-alpha',
      content: '# Version 4.2.0-alpha\n\nAlpha version for testing new architecture.',
      released: false, // This version is NOT released
      createDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      createdBy: 'existing-user-1',
      updatedBy: 'existing-user-1',
      updatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      project: 'test-project-1',
      archived: false
    });

    console.log('✅ Migration test documents created!');
    console.log('');
    console.log('📋 Migration Test Scenarios:');
    console.log('   1. doc-needs-migration: Has 2 versions (1.0.0, 1.1.0) with NO commits - NEEDS MIGRATION');
    console.log('   2. doc-already-migrated: Has 2 versions (2.0.0, 2.1.0) with matching commits - ALREADY MIGRATED');  
    console.log('   3. doc-partial-migration: Has 3 versions but only 2 commits - PARTIAL MIGRATION NEEDED');
    console.log('   4. doc-no-versions: No versions at all - SHOULD BE IGNORED');
    console.log('   5. doc-unreleased-versions: Has 1 released + 2 unreleased versions - TEST UNRELEASED HANDLING');
    console.log('');

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
    console.log('🔄 Migration Test Data:');
    console.log('   Expected behavior when migration system runs:');
    console.log('   ✅ doc-needs-migration: Should be migrated (2 versions → 2 commits)');
    console.log('   ⏭️  doc-already-migrated: Should be skipped (already has matching commits)');
    console.log('   🔄 doc-partial-migration: Should migrate 1 version (3.2.0 → 1 new commit)');
    console.log('   ⏭️  doc-no-versions: Should be ignored (no versions to migrate)');
    console.log('   🧪 doc-unreleased-versions: Should migrate only released version (4.0.0 → 1 commit)');
    console.log('       Unreleased versions (4.1.0-beta, 4.2.0-alpha) should be skipped');
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