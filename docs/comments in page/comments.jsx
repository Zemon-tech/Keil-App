import React, { useState } from 'react';
import MotionPageComments from '@/components/MotionPageComments';
import { useAuth } from '@/hooks/useAuth'; // Your auth hook
import { useParams } from 'react-router-dom'; // or your router

/**
 * EXAMPLE 1: Basic Integration
 * Simple setup in a workspace page
 */
export function WorkspacePageBasic() {
  const { user } = useAuth();
  const { pageId } = useParams();

  return (
    <div className="workspace-page">
      <header>
        <h1>Workspace Page</h1>
      </header>

      <main>
        <section className="page-content">
          {/* Your page content here */}
          <h2>Page Title</h2>
          <p>Page content goes here...</p>
        </section>

        <aside className="page-sidebar">
          <MotionPageComments
            pageId={pageId}
            currentUserId={user.id}
            currentUserName={user.displayName || user.email}
            currentUserAvatar={user.profilePicture}
          />
        </aside>
      </main>
    </div>
  );
}

/**
 * EXAMPLE 2: With Custom Styling
 * Styled workspace page with comments
 */
export function WorkspacePageStyled() {
  const { user } = useAuth();
  const { pageId } = useParams();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
      <main>
        <div style={{ padding: '24px', background: '#fff', borderRadius: '8px' }}>
          <h1 style={{ marginTop: 0 }}>My Document</h1>
          <article>
            <p>Document content goes here...</p>
            <h2>Section Title</h2>
            <p>More content...</p>
          </article>
        </div>
      </main>

      <aside
        style={{
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px',
          height: 'fit-content',
          position: 'sticky',
          top: '16px'
        }}
      >
        <h3 style={{ marginTop: 0 }}>Discussion</h3>
        <MotionPageComments
          pageId={pageId}
          currentUserId={user.id}
          currentUserName={user.name}
          currentUserAvatar={user.avatar}
        />
      </aside>
    </div>
  );
}

/**
 * EXAMPLE 3: Full-Width Comments Section
 * Comments at bottom of page
 */
export function WorkspacePageFullWidth() {
  const { user } = useAuth();
  const { pageId } = useParams();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <section style={{ padding: '32px 0' }}>
        <h1>Workspace Document</h1>
        <article>
          <p>Your page content here...</p>
        </article>
      </section>

      <section
        style={{
          padding: '32px 0',
          borderTop: '1px solid #e5e7eb'
        }}
      >
        <MotionPageComments
          pageId={pageId}
          currentUserId={user.id}
          currentUserName={user.name}
          currentUserAvatar={user.avatar}
        />
      </section>
    </div>
  );
}

/**
 * EXAMPLE 4: With Comments Counter
 * Shows comment count in page header
 */
export function WorkspacePageWithCounter() {
  const { user } = useAuth();
  const { pageId } = useParams();
  const [commentCount, setCommentCount] = useState(0);

  // Load comment count on mount
  React.useEffect(() => {
    const savedComments = localStorage.getItem(`motion_comments_${pageId}`);
    if (savedComments) {
      try {
        const comments = JSON.parse(savedComments);
        setCommentCount(comments.length);
      } catch (error) {
        console.error('Failed to load comment count:', error);
      }
    }
  }, [pageId]);

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Workspace Page</h1>
        <div
          style={{
            fontSize: '14px',
            color: '#666',
            background: '#f0f0f0',
            padding: '8px 12px',
            borderRadius: '20px'
          }}
        >
          💬 {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </div>
      </header>

      <MotionPageComments
        pageId={pageId}
        currentUserId={user.id}
        currentUserName={user.name}
        currentUserAvatar={user.avatar}
      />
    </div>
  );
}

/**
 * EXAMPLE 5: Multi-Tab Interface
 * Comments as one of multiple tabs
 */
export function WorkspacePageWithTabs() {
  const { user } = useAuth();
  const { pageId } = useParams();
  const [activeTab, setActiveTab] = useState('content');

  return (
    <div>
      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('content')}
          style={{
            padding: '12px 24px',
            borderBottom: activeTab === 'content' ? '2px solid #3b82f6' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'content' ? '500' : '400',
            color: activeTab === 'content' ? '#3b82f6' : '#666'
          }}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            padding: '12px 24px',
            borderBottom: activeTab === 'comments' ? '2px solid #3b82f6' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'comments' ? '500' : '400',
            color: activeTab === 'comments' ? '#3b82f6' : '#666'
          }}
        >
          Comments
        </button>
      </div>

      <div>
        {activeTab === 'content' && (
          <section>
            <h2>Page Content</h2>
            <p>Your content here...</p>
          </section>
        )}

        {activeTab === 'comments' && (
          <section>
            <MotionPageComments
              pageId={pageId}
              currentUserId={user.id}
              currentUserName={user.name}
              currentUserAvatar={user.avatar}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * EXAMPLE 6: Dark Mode Support
 * Component with dark mode toggle
 */
export function WorkspacePageDarkMode() {
  const { user } = useAuth();
  const { pageId } = useParams();
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div
      style={{
        background: darkMode ? '#1f1f1f' : '#ffffff',
        color: darkMode ? '#ffffff' : '#000000',
        minHeight: '100vh',
        transition: 'background-color 0.3s'
      }}
    >
      <header style={{ padding: '16px', borderBottom: `1px solid ${darkMode ? '#333' : '#e5e7eb'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Workspace</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '8px 12px',
              background: darkMode ? '#333' : '#f0f0f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: darkMode ? '#fff' : '#000'
            }}
          >
            {darkMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>

      <main style={{ padding: '24px' }}>
        <MotionPageComments
          pageId={pageId}
          currentUserId={user.id}
          currentUserName={user.name}
          currentUserAvatar={user.avatar}
        />
      </main>
    </div>
  );
}

/**
 * EXAMPLE 7: With Activity Summary
 * Shows who commented and when
 */
export function WorkspacePageWithActivity() {
  const { user } = useAuth();
  const { pageId } = useParams();
  const [recentCommenters, setRecentCommenters] = useState([]);

  React.useEffect(() => {
    const savedComments = localStorage.getItem(`motion_comments_${pageId}`);
    if (savedComments) {
      try {
        const comments = JSON.parse(savedComments);
        // Get unique users who commented
        const commenters = Array.from(
          new Map(comments.map(c => [c.userId, c])).values()
        ).slice(0, 5); // Last 5 unique commenters
        setRecentCommenters(commenters);
      } catch (error) {
        console.error('Failed to load recent commenters:', error);
      }
    }
  }, [pageId]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
      <main>
        <h1>Workspace Page</h1>
        <article>
          <p>Page content...</p>
        </article>
      </main>

      <aside>
        <div style={{ padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Activity</h3>

          {recentCommenters.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                Recent Commenters
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {recentCommenters.map(commenter => (
                  <div
                    key={commenter.userId}
                    title={commenter.userName}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {commenter.userName.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #ddd' }} />

          <MotionPageComments
            pageId={pageId}
            currentUserId={user.id}
            currentUserName={user.name}
            currentUserAvatar={user.avatar}
          />
        </div>
      </aside>
    </div>
  );
}

/**
 * EXAMPLE 8: With User Authentication Fallback
 * Handles cases where user might not be logged in
 */
export function WorkspacePageWithAuthFallback() {
  const authContext = useAuth();
  const { pageId } = useParams();

  if (!authContext || !authContext.user) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>Please log in to view and comment on this page.</p>
        <button onClick={() => window.location.href = '/login'}>
          Log In
        </button>
      </div>
    );
  }

  const { user } = authContext;

  return (
    <div>
      <h1>Workspace Page</h1>
      <MotionPageComments
        pageId={pageId}
        currentUserId={user.id}
        currentUserName={user.displayName || 'Anonymous User'}
        currentUserAvatar={user.profilePicture || user.avatar}
      />
    </div>
  );
}

/**
 * EXAMPLE 9: Testing Scenario
 * Multiple different users in same page
 */
export function WorkspacePageTestMultiUser() {
  const { pageId } = useParams();
  const [currentUser, setCurrentUser] = useState('user-1');

  const users = {
    'user-1': { name: 'Alice Johnson', avatar: null },
    'user-2': { name: 'Bob Smith', avatar: null },
    'user-3': { name: 'Carol White', avatar: null }
  };

  const user = users[currentUser];

  return (
    <div>
      <div style={{ marginBottom: '24px', padding: '16px', background: '#f0f0f0', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Test Different Users</h3>
        <p>Switch between users to test multi-user functionality:</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.entries(users).map(([userId, userData]) => (
            <button
              key={userId}
              onClick={() => setCurrentUser(userId)}
              style={{
                padding: '8px 16px',
                background: currentUser === userId ? '#3b82f6' : '#ddd',
                color: currentUser === userId ? 'white' : 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {userData.name}
            </button>
          ))}
        </div>
      </div>

      <MotionPageComments
        pageId={pageId}
        currentUserId={currentUser}
        currentUserName={user.name}
        currentUserAvatar={user.avatar}
      />
    </div>
  );
}

/**
 * EXAMPLE 10: Integration with Redux
 * If your app uses Redux for state management
 */
import { useSelector } from 'react-redux';

export function WorkspacePageWithRedux() {
  const user = useSelector(state => state.auth.user);
  const { pageId } = useParams();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <MotionPageComments
      pageId={pageId}
      currentUserId={user.id}
      currentUserName={user.name}
      currentUserAvatar={user.photoURL}
    />
  );
}

/**
 * INTEGRATION CHECKLIST
 * 
 * Before deploying, ensure:
 * 
 * [ ] Import MotionPageComments in your page component
 * [ ] Replace with your actual auth hook
 * [ ] Replace with your actual router (useParams or similar)
 * [ ] Pass correct currentUserId from auth system
 * [ ] Pass correct currentUserName from auth system
 * [ ] Pass correct currentUserAvatar if available
 * [ ] Test with multiple users
 * [ ] Test edit/delete functionality
 * [ ] Test reply functionality
 * [ ] Verify localStorage persistence
 * [ ] Test on mobile devices
 * [ ] Test with various browser widths
 * [ ] Check accessibility with keyboard
 * [ ] Verify styles match your design system
 * [ ] Update CSS variables if needed
 */
