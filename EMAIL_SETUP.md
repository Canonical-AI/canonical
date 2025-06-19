# 🔗 Collaboration Setup Guide

This guide explains how the simplified invitation system works in your self-hosted instance.

## 🏗️ Architecture Overview

The collaboration system uses a **simple link-sharing approach**:

```
🔗 Invitation Flow:
Admin creates invite → System generates shareable link → Recipient signs up → Auto-added to project
```

**No email service required!** This makes self-hosting much simpler.

## ✅ Benefits of This Approach

- ✅ **Zero external dependencies** - No email service configuration needed
- ✅ **Self-hosting friendly** - Works immediately after deployment
- ✅ **User control** - Admins choose how to share links (email, Slack, Teams, etc.)
- ✅ **No deliverability issues** - Links always work
- ✅ **Cost effective** - No email service costs
- ✅ **Simple debugging** - Everything happens in your main app

## 🛠️ How It Works

### Step 1: Create Invitation
1. Project admin enters recipient's email address
2. System generates a unique invitation link
3. Admin copies the link to share however they prefer

### Step 2: Share Link
The admin can share the invitation link via:
- Email (using their own email client)
- Slack/Teams/Discord
- Text message
- Any communication method they prefer

### Step 3: Automatic Project Addition
1. Recipient clicks the invitation link
2. They sign up using the exact email address from the invitation
3. System automatically adds them to the project
4. No manual approval needed!

## 🔧 Configuration

**No configuration required!** The system works out of the box.

### Optional: Customize Invitation Links
You can customize the invitation link format by updating the base URL:

```javascript
// In your environment variables
VITE_APP_BASE_URL=https://your-domain.com
```

## 📋 Required Permissions (Firebase Only)

Since we're not using Cloud Functions, you only need basic Firebase permissions:

### Firebase Project Permissions
```json
{
  "roles": [
    "roles/firebase.developAdmin", 
    "roles/firebaseauth.admin",
    "roles/firestore.user"
  ]
}
```

### Required APIs to Enable
```bash
# Basic Firebase APIs
gcloud services enable firebase.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable identitytoolkit.googleapis.com
```

## 🔒 Security Features

### Built-in Security
- **Email validation**: Recipients must sign up with the exact invited email
- **Token expiration**: Invitation links expire after 7 days
- **Role-based access**: Only project admins can create invitations
- **One-time use**: Links are marked as used after signup

### Rate Limiting
Default invitation limits:
- **Per user**: 10 invitations per hour
- **Per project**: 50 invitations per day

You can adjust these in your Firebase Security Rules.

## 🧪 Testing the System

### Test Invitation Flow
1. **Create invitation**: Go to Project Settings → Manage Users
2. **Enter email**: Add test email and select role
3. **Copy link**: Use the generated invitation link
4. **Test signup**: Open link in incognito and sign up with that email
5. **Verify access**: Check that user is automatically added to project

## 📱 User Experience

### For Project Admins
```
1. Enter recipient email: john@company.com
2. Select role: User/Admin
3. Click "Invite User"
4. Copy the generated link
5. Share via their preferred method
```

### For Recipients
```
1. Receive invitation link
2. Click link → Taken to signup page
3. Sign up with the invited email address
4. Automatically added to project
5. Start collaborating immediately!
```

## 🔄 Migration from Other Systems

### From Email-based Systems
- **No migration needed** - This approach is simpler
- **Better user control** - Admins choose how to share

### To Supabase (Future)
- **Same approach works** - Link generation is platform-agnostic
- **Database changes only** - Core logic remains the same
- **No email service dependencies** to migrate

## 📞 Troubleshooting

### Common Issues

**"User not automatically added to project"**
- Verify they signed up with the exact email address
- Check that invitation hasn't expired (7 days)
- Ensure invitation link is complete/not truncated

**"Invalid invitation link"**
- Link may have expired
- Check for typos in the URL
- Generate a new invitation if needed

**"Permission denied creating invitations"**
- Only project admins can create invitations
- Check user's role in the project

### Debug Information
- Invitation status is tracked in Firestore `invitations` collection
- User-project relationships are in `userProjects` collection
- Check browser console for detailed error messages

## 🎯 Best Practices

### For Self-Hosters
1. **Customize invitation email template** in the share dialog
2. **Set up proper domain** for professional-looking links
3. **Monitor invitation usage** via Firestore console
4. **Set appropriate expiration times** for your use case

### For End Users
1. **Always verify the email address** before sharing links
2. **Use secure communication channels** to share sensitive invitations
3. **Set clear expectations** about signup requirements
4. **Follow up** if recipients don't join within a few days

## 🚀 Advanced Features

### Custom Invitation Messages
The system generates a default email template, but admins can customize the message before sharing.

### Bulk Invitations
You can extend the system to support multiple email addresses at once by:
1. Creating multiple invitation records
2. Generating multiple links
3. Providing a summary of all generated links

### Integration with External Tools
Since this is just link sharing, you can integrate with:
- **Slack bots** - Auto-share links in channels
- **Email newsletters** - Include invitation links
- **QR codes** - For in-person sharing

## 📊 Analytics

Track invitation success by monitoring:
- Invitation creation rate
- Link click-through rate (via your analytics)
- Signup conversion rate
- Time from invitation to project activity

---

**This approach eliminates email service complexity while providing a better user experience and maximum flexibility for self-hosters!** 