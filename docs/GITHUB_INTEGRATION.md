# GitHub Integration Setup Guide

This guide explains how to set up and use the GitHub integration for pulling commit data from pull requests to generate release notes.

## 🏗️ Architecture Overview

The GitHub integration provides:
- OAuth authentication for private repositories
- Secure token storage in Firestore
- Pull request and commit data fetching
- Automated release notes generation
- Support for both public and private repositories

## 🔧 Setup Requirements

### 1. GitHub OAuth App Configuration

You'll need to create a GitHub OAuth App to enable private repository access:

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Your App Name
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/settings/github/callback`
4. Save the app and note the **Client ID** and **Client Secret**

### 2. Environment Variables

Add these environment variables to your `.env` file:

```bash
# GitHub OAuth Integration (Optional)
# Required for private repository access and release notes generation
VITE_GITHUB_CLIENT_ID=your_github_oauth_app_client_id
VITE_GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
```

⚠️ **Security Note**: Never commit your `.env` file. The client secret should be kept secure.

### 3. Firestore Security Rules

Ensure your Firestore rules allow users to read/write their own integration data:

```javascript
// Add this to your firestore.rules
match /userIntegrations/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## 🚀 Usage Examples

### Basic Usage in Components

```vue
<template>
  <div>
    <v-btn @click="generateReleaseNotes" :loading="loading">
      Generate Release Notes
    </v-btn>
    
    <v-textarea 
      v-if="releaseNotes" 
      :value="releaseNotes" 
      readonly 
    />
  </div>
</template>

<script>
import { GitHubService } from '@/services/githubService';

export default {
  data() {
    return {
      loading: false,
      releaseNotes: null
    };
  },
  methods: {
    async generateReleaseNotes() {
      this.loading = true;
      try {
        // Fetch PRs from the last 30 days
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 30);
        
        const prResult = await GitHubService.fetchMultiplePRs('owner', 'repo', {
          base: 'main',
          since: sinceDate.toISOString()
        });
        
        if (prResult.success) {
          const notesResult = GitHubService.generateReleaseNotes(prResult.data, {
            version: 'v1.2.3',
            format: 'markdown'
          });
          
          if (notesResult.success) {
            this.releaseNotes = notesResult.data.releaseNotes;
          }
        }
      } catch (error) {
        console.error('Error generating release notes:', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

### Using Store Actions

```javascript
// In your Vue component
export default {
  methods: {
    async checkGitHubConnection() {
      const result = await this.$store.githubGetConnectionStatus();
      if (result.success && result.data.connected) {
        console.log('Connected as:', result.data.username);
      }
    },
    
    async fetchPRData() {
      const result = await this.$store.githubFetchPRData('owner', 'repo', 123);
      if (result.success) {
        console.log('PR data:', result.data);
      }
    },
    
    async generateRelease() {
      // Fetch multiple PRs
      const prResult = await this.$store.githubFetchMultiplePRs('owner', 'repo', {
        prNumbers: [123, 124, 125]
      });
      
      if (prResult.success) {
        // Generate release notes
        const notesResult = await this.$store.githubGenerateReleaseNotes(prResult.data, {
          version: 'v1.2.3',
          format: 'markdown'
        });
        
        if (notesResult.success) {
          console.log('Release notes:', notesResult.data.releaseNotes);
        }
      }
    }
  }
};
```

## 📋 API Reference

### GitHubService Methods

#### `initiateOAuthFlow(clientId, redirectUri)`
Initiates GitHub OAuth flow for connecting user account.

#### `completeOAuthFlow(code, state, clientId, clientSecret)`
Completes OAuth flow and stores access token securely.

#### `getConnectionStatus()`
Returns current GitHub connection status and user info.

#### `disconnectAccount()`
Disconnects GitHub account and removes stored credentials.

#### `fetchPullRequestData(owner, repo, prNumber)`
Fetches detailed data for a specific pull request including commits and files.

#### `fetchMultiplePRs(owner, repo, options)`
Fetches multiple PRs based on criteria:
- `options.base`: Base branch (e.g., 'main')
- `options.since`: ISO date string for PRs since this date
- `options.prNumbers`: Array of specific PR numbers

#### `generateReleaseNotes(prData, options)`
Generates release notes from PR data:
- `options.version`: Version number for release
- `options.format`: Output format ('markdown', 'html', 'text')

### Store Actions

- `githubGetConnectionStatus()`: Check GitHub connection status
- `githubDisconnectAccount()`: Disconnect GitHub account
- `githubFetchPRData(owner, repo, prNumber)`: Fetch single PR data
- `githubFetchMultiplePRs(owner, repo, options)`: Fetch multiple PRs
- `githubGenerateReleaseNotes(prData, options)`: Generate release notes

## 🔒 Security Features

### OAuth Security
- Uses GitHub OAuth 2.0 with proper state validation
- CSRF protection with random state parameter
- Minimal required scopes (`repo`, `read:org`)

### Token Storage
- Access tokens stored encrypted in Firestore
- User-specific document isolation
- Automatic cleanup on disconnection

### Permission Management
- Follows existing permission helper patterns
- Requires user authentication
- Validates user access to repositories

## 🎯 Categorization Logic

The system automatically categorizes PRs based on:

### Features
- Labels: `feature`, `enhancement`
- Title prefixes: `feat:`, `add:`

### Bug Fixes
- Labels: `bug`, `bugfix`
- Title prefixes: `fix:`, `bug:`

### Improvements
- Labels: `improvement`, `refactor`
- Title prefixes: `improve:`, `refactor:`

### Other
- All other PRs that don't match the above criteria

## 🚦 Rate Limiting

GitHub API has rate limits:
- **Authenticated requests**: 5,000 per hour
- **Unauthenticated requests**: 60 per hour

The service automatically handles rate limiting and provides helpful error messages.

## 🔧 Troubleshooting

### Common Issues

1. **"GitHub account not connected"**
   - User needs to connect their GitHub account first
   - Check OAuth app configuration

2. **"Repository or resource not found"**
   - Check repository name and owner
   - Verify user has access to private repositories
   - Ensure OAuth app has correct permissions

3. **"GitHub API rate limit exceeded"**
   - Wait for rate limit to reset (shown in error message)
   - Consider reducing the number of PRs fetched

4. **"Invalid or expired invitation"**
   - Check OAuth app client ID and secret
   - Verify callback URL matches OAuth app configuration

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('github-debug', 'true');
```

## 🔄 Future Enhancements

Potential improvements:
- Webhook integration for real-time updates
- Custom PR categorization rules
- Template-based release note generation
- Integration with project milestones
- Support for multiple repositories
- Automated release creation on GitHub

## 📖 Additional Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started) 