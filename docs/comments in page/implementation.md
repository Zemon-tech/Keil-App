// MOTION PAGE COMMENTS SYSTEM - IMPLEMENTATION GUIDE
// ====================================================

/**
 * COMPONENT OVERVIEW
 * 
 * This is a fully-featured comment system for Motion workspace pages.
 * 
 * Key Features:
 * ✓ Add, edit, delete comments (users can only modify their own)
 * ✓ Reply to comments with nested threading
 * ✓ Like/unlike comments
 * ✓ User identification with color-coded avatars
 * ✓ Timestamp formatting (just now, 5m ago, etc.)
 * ✓ Sort comments (newest, oldest, most liked)
 * ✓ Persistent storage in localStorage (no backend required)
 * ✓ Multi-user support with proper user ID tracking
 * ✓ Responsive design
 */

// ============================================================================
// INSTALLATION & SETUP
// ============================================================================

/*
1. COPY THE COMPONENT
   - Copy MotionPageComments.jsx to your project:
     src/components/MotionPageComments.jsx

2. INSTALL DEPENDENCIES (if not already installed)
   - React 16.8+ (hooks support required)
   - No other external dependencies needed!

3. IMPORT IN YOUR PAGE
   import MotionPageComments from '@/components/MotionPageComments';
*/

// ============================================================================
// BASIC USAGE
// ============================================================================

/*
// In your workspace page component:

import MotionPageComments from '@/components/MotionPageComments';
import { useAuth } from '@/hooks/useAuth'; // Your auth hook

export default function WorkspacePage() {
  const { user } = useAuth(); // Assuming user object has: { id, name, avatar }

  return (
    <div className="workspace-page">
      <h1>My Workspace Page</h1>
      
      <MotionPageComments
        pageId="workspace-page-1" // Unique identifier for this page
        currentUserId={user.id}
        currentUserName={user.name}
        currentUserAvatar={user.avatar}
      />
    </div>
  );
}
*/

// ============================================================================
// PROP TYPES & CONFIGURATION
// ============================================================================

/*
REQUIRED PROPS:
None - all have sensible defaults

OPTIONAL PROPS:

1. pageId (string)
   - Default: 'page-1'
   - Purpose: Unique identifier for the page
   - Used for localStorage key isolation
   - Change this for different pages to have separate comment threads
   - Example: 'workspace-page-abc123', 'doc-456', 'task-789'

2. currentUserId (string)
   - Default: 'user-123'
   - Purpose: Unique identifier of the logged-in user
   - Used to determine edit/delete permissions
   - Also used to identify user's likes
   - Should match your auth system's user ID
   - Example: user.id, user._id, user.uid

3. currentUserName (string)
   - Default: 'You'
   - Purpose: Display name of the logged-in user
   - Shown in comments made by this user
   - Should match your auth system's user name
   - Example: 'John Doe', 'alice@company.com', user.displayName

4. currentUserAvatar (string, optional)
   - Default: null (generates colored avatar with initials)
   - Purpose: Avatar image URL for the current user
   - If provided, displays image instead of initials
   - Example: 'https://api.example.com/avatars/user123.jpg'
*/

// ============================================================================
// DATA STRUCTURE
// ============================================================================

/*
Each comment object has this structure:

{
  id: "comment_1234567890_abc123", // Auto-generated unique ID
  userId: "user-123",              // User who created comment
  userName: "John Doe",            // User's display name
  userAvatar: null,                // User's avatar URL (optional)
  text: "This is a comment",       // Comment content
  timestamp: "2024-01-15T10:30:00Z", // ISO timestamp
  likes: 5,                        // Like count
  replies: [                       // Array of reply objects
    {
      id: "comment_9876543210_xyz789",
      userId: "user-456",
      userName: "Jane Smith",
      userAvatar: null,
      text: "This is a reply",
      timestamp: "2024-01-15T10:35:00Z",
      likes: 2
    }
  ]
}

Data is stored in localStorage with these keys:
- motion_comments_{pageId}      // All comments for the page
- motion_likes_{pageId}_{userId} // Liked comment IDs for this user
*/

// ============================================================================
// STORAGE & PERSISTENCE
// ============================================================================

/*
USING LOCALSTORAGE (CURRENT IMPLEMENTATION):

✓ Pros:
  - No backend changes required
  - Works offline
  - Simple setup
  - Syncs instantly across browser tabs
  - Data persists across page refreshes

✗ Cons:
  - Data limited to ~5-10MB per domain
  - Only syncs within same browser/device
  - Not shared between devices/browsers
  - Limited to domain, not per-user

IMPORTANT:
- Data is stored per pageId
- Each user's likes are stored separately
- Clear browser data = comments are lost
- Use browser dev tools to inspect: localStorage.getItem('motion_comments_page-1')
*/

// ============================================================================
// ADVANCED: MIGRATING TO BACKEND
// ============================================================================

/*
To migrate from localStorage to a real backend WITHOUT changing the component,
you only need to modify the useEffect hooks that handle localStorage:

CURRENT CODE (in useEffect):
  const savedComments = localStorage.getItem(`motion_comments_${pageId}`);
  if (savedComments) {
    setComments(JSON.parse(savedComments));
  }

REPLACE WITH API CALL:
  useEffect(() => {
    fetch(`/api/pages/${pageId}/comments`)
      .then(res => res.json())
      .then(data => setComments(data));
  }, [pageId]);

CURRENT CODE (save comments):
  useEffect(() => {
    localStorage.setItem(`motion_comments_${pageId}`, JSON.stringify(comments));
  }, [comments, pageId]);

REPLACE WITH API CALL:
  const handleAddComment = async () => {
    if (newComment.trim()) {
      const response = await fetch(`/api/pages/${pageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          userName: currentUserName,
          text: newComment
        })
      });
      const newCommentData = await response.json();
      setComments([newCommentData, ...comments]);
      setNewComment('');
    }
  };

The component logic doesn't change - same props, same features, same UI!
*/

// ============================================================================
// USER IDENTIFICATION & AVATARS
// ============================================================================

/*
HOW USER IDENTIFICATION WORKS:

1. Each user is identified by their userId
2. Users can only edit/delete their own comments
3. Permissions check: comment.userId === currentUserId
4. Edit/delete buttons only appear for user's own comments

AVATAR GENERATION:

1. If currentUserAvatar is provided:
   - Image is displayed (must be valid image URL)
   - Fallback to initials if image fails to load

2. If currentUserAvatar is null:
   - Initials are generated from userName
   - "John Doe" → "JD"
   - "Alice" → "A"
   - Color is generated from userId hash (consistent per user)
   - 10 different colors, so no collisions for most use cases

HOW TO GET USER DATA:

From your auth system:
  const { user } = useAuth(); // or useContext, etc.
  
  <MotionPageComments
    pageId={pageId}
    currentUserId={user.id}
    currentUserName={user.displayName || user.name}
    currentUserAvatar={user.photoURL || user.avatar}
  />

From Redux:
  const user = useSelector(state => state.auth.user);
  
  <MotionPageComments
    pageId={pageId}
    currentUserId={user.id}
    currentUserName={user.name}
    currentUserAvatar={user.profilePicture}
  />
*/

// ============================================================================
// MULTI-PAGE SETUP
// ============================================================================

/*
Each page gets its own isolated comment thread.
Comments don't appear across pages unless they share the same pageId.

EXAMPLE WITH MULTIPLE PAGES:

export default function WorkspacePage() {
  const { user } = useAuth();
  const { pageId } = useParams();

  return (
    <MotionPageComments
      pageId={pageId} // Each page has different ID
      currentUserId={user.id}
      currentUserName={user.name}
      currentUserAvatar={user.avatar}
    />
  );
}

// Page 1: pageId = 'page-abc123'
// Page 2: pageId = 'page-xyz789'
// Comments stored separately in:
// - motion_comments_page-abc123
// - motion_comments_page-xyz789
*/

// ============================================================================
// CUSTOMIZATION
// ============================================================================

/*
1. STYLING MODIFICATIONS:

The component uses CSS variables for theming:
  - var(--color-text-primary)       // Main text
  - var(--color-text-secondary)     // Muted text
  - var(--color-text-tertiary)      // Hints
  - var(--color-background-primary) // White background
  - var(--color-background-secondary) // Surface bg
  - var(--color-border-tertiary)    // Subtle borders
  - var(--color-background-info)    // Blue/info color
  - var(--color-text-danger)        // Red/danger color

If your theme system uses different variable names, update all 
instances in the component to match your theme.

2. COLOR SCHEME:

To change avatar colors, modify the getUserColor function:
  const colors = [
    '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
    // Add more hex colors here
  ];

3. TIMESTAMP FORMAT:

The formatTime function shows: "Just now", "5m ago", "2h ago"
To show exact dates instead, replace the formatTime function:
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

4. KEYBOARD SHORTCUTS:

Currently: Ctrl+Enter to submit comment
To add more shortcuts, modify the onKeyDown handler in textarea

5. CHARACTER LIMITS:

To add character limits, modify the textarea and add validation:
  const MAX_LENGTH = 5000;
  
  onChange={(e) => {
    if (e.target.value.length <= MAX_LENGTH) {
      setNewComment(e.target.value);
    }
  }}
*/

// ============================================================================
// MANAGING COMMENTS PROGRAMMATICALLY
// ============================================================================

/*
Since comments are in state, you can add features like:

1. CLEAR ALL COMMENTS:
   const handleClearAll = () => {
     setComments([]);
     localStorage.removeItem(`motion_comments_${pageId}`);
   };

2. EXPORT COMMENTS:
   const handleExportComments = () => {
     const dataStr = JSON.stringify(comments, null, 2);
     const dataBlob = new Blob([dataStr], { type: 'application/json' });
     const url = URL.createObjectURL(dataBlob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `comments-${pageId}.json`;
     link.click();
   };

3. IMPORT COMMENTS:
   const handleImportComments = (file) => {
     const reader = new FileReader();
     reader.onload = (e) => {
       try {
         const imported = JSON.parse(e.target.result);
         setComments([...imported, ...comments]);
       } catch (error) {
         console.error('Invalid JSON file');
       }
     };
     reader.readAsText(file);
   };

4. GET STATISTICS:
   const totalComments = comments.length;
   const totalReplies = comments.reduce((sum, c) => sum + (c.replies?.length || 0), 0);
   const totalLikes = comments.reduce((sum, c) => sum + c.likes, 0);
*/

// ============================================================================
// TESTING
// ============================================================================

/*
1. MANUAL TESTING:

// Test adding comments
  1. Type comment and click "Comment" button
  2. Verify comment appears in list
  3. Refresh page - comment should persist

// Test editing
  1. Click "Edit" on your comment
  2. Modify text and save
  3. Verify update appears immediately

// Test deleting
  1. Click "Delete" on your comment
  2. Confirm deletion
  3. Verify comment is removed

// Test multi-user
  1. Change currentUserId prop
  2. Add comment as different user
  3. Verify you can only edit your own comments
  4. Verify "Author" badge shows for your comments

// Test replies
  1. Click "Reply" on a comment
  2. Write reply and click "Reply" button
  3. Expand/collapse replies
  4. Test reply count

// Test localStorage isolation
  1. Open browser DevTools (F12)
  2. Go to Application > Local Storage
  3. Verify data stored in motion_comments_pageId

2. UNIT TESTING EXAMPLE (Jest):

import { render, screen, fireEvent } from '@testing-library/react';
import MotionPageComments from './MotionPageComments';

describe('MotionPageComments', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders comment form', () => {
    render(
      <MotionPageComments
        pageId="test-page"
        currentUserId="user-1"
        currentUserName="Test User"
      />
    );
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  });

  test('adds comment', () => {
    render(
      <MotionPageComments
        pageId="test-page"
        currentUserId="user-1"
        currentUserName="Test User"
      />
    );
    const textarea = screen.getByPlaceholderText('Add a comment...');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });
    fireEvent.click(screen.getByText('Comment'));
    expect(screen.getByText('Test comment')).toBeInTheDocument();
  });
});
*/

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/*
PROBLEM: Comments not persisting
SOLUTION:
  - Check localStorage is enabled (Settings > Privacy > Cookies)
  - Verify correct pageId is used
  - Check browser console for errors
  - Try: localStorage.getItem('motion_comments_page-1')

PROBLEM: User avatars not showing
SOLUTION:
  - currentUserAvatar URL might be invalid
  - Check CORS headers if using external image
  - Fallback to initials is working (intended behavior)

PROBLEM: Comments from other users visible as "Author"
SOLUTION:
  - "Author" badge only shows if userId matches
  - Verify correct currentUserId is passed
  - Verify userId values from auth system are consistent

PROBLEM: Likes not persisting
SOLUTION:
  - Likes are stored per-user per-page
  - Different currentUserId = different likes
  - Check localStorage key: motion_likes_pageId_userId

PROBLEM: Component not rendering
SOLUTION:
  - React version must be 16.8+
  - Check console for error messages
  - Verify all props are correct types (strings)
  - Try with default props: <MotionPageComments />

PROBLEM: Styles look wrong
SOLUTION:
  - CSS variables might not be defined in your app
  - Define them in your global CSS:
    --color-text-primary: #000;
    --color-background-primary: #fff;
    --color-border-tertiary: #e5e7eb;
    // etc.
  - Or modify component to use direct color values
*/

// ============================================================================
// PERFORMANCE NOTES
// ============================================================================

/*
- Component handles 100+ comments efficiently
- No external API calls (localStorage only)
- Rendering is optimized with keys
- localStorage size: ~1KB per 10 comments
- For 1000+ comments, consider pagination

If you need pagination:
  const itemsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedComments = sortedComments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
*/

// ============================================================================
// SECURITY NOTES
// ============================================================================

/*
⚠️  IMPORTANT: This component uses localStorage, which has security implications:

1. DATA VISIBILITY:
   - Comments are stored as plain text in localStorage
   - Accessible to any JavaScript on the same domain
   - XSS attacks can read comment data
   - Mitigation: Always sanitize user input (not done in this component)

2. AUTHENTICATION:
   - This component trusts currentUserId
   - Front-end cannot be trusted for permissions
   - MUST validate on backend if migrating to real storage
   - Anyone can change currentUserId in browser console

3. RECOMMENDATIONS:
   - Add input sanitization (use DOMPurify library)
   - Validate permissions on backend
   - Use HTTPS only
   - Implement CSRF tokens
   - Don't store sensitive data in comments
   - Consider user roles/permissions

EXAMPLE SANITIZATION:
  import DOMPurify from 'dompurify';
  
  const sanitized = DOMPurify.sanitize(newComment);
  // Then store sanitized version
*/

// ============================================================================
// ACCESSIBILITY
// ============================================================================

/*
The component includes:
- Semantic HTML structure
- Proper button elements
- Keyboard navigation support
- Color not the only indicator (icons + text)
- Sufficient color contrast
- Focus states

Improvements you can add:
- ARIA labels on buttons
- Keyboard shortcuts help text
- Screen reader announcements for new comments
- Focus management when replying
*/

// ============================================================================
export default MotionPageComments;