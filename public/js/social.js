// Gantec Idea Hub - Global State
var globalSocialPosts = [];
var socialLastSeenActivityCount = parseInt(localStorage.getItem('social_seen_activity_count') || localStorage.getItem('social_seen_count') || '0');

async function loadSocialFeed() {
  try {
    var res = await fetch('/api/social/feed');
    var data = await res.json();
    if (data.success) {
      globalSocialPosts = data.posts;
      updateSocialBadge();
      renderSocialFeed();
    }
  } catch(e) {
    console.error('Social feed error:', e);
  }
}

function getActivityCount() {
  var count = globalSocialPosts.length;
  for (var i = 0; i < globalSocialPosts.length; i++) {
    var post = globalSocialPosts[i];
    count += (post.comments ? post.comments.length : 0);
    count += (post.likesCount || 0);
  }
  return count;
}

function updateSocialBadge() {
  var badge = document.getElementById('social-badge');
  if (!badge) return;
  var totalActivity = getActivityCount();

  // If the social widget is actively open, dynamically mark loaded posts as seen
  if (typeof instaWidgetOpen !== 'undefined' && instaWidgetOpen) {
    socialLastSeenActivityCount = totalActivity;
    localStorage.setItem('social_seen_activity_count', String(socialLastSeenActivityCount));
  }

  var newCount = totalActivity - socialLastSeenActivityCount;
  if (newCount > 0) {
    badge.textContent = newCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function markPostsAsSeen() {
  socialLastSeenActivityCount = getActivityCount();
  localStorage.setItem('social_seen_activity_count', String(socialLastSeenActivityCount));
  var badge = document.getElementById('social-badge');
  if (badge) badge.style.display = 'none';
}

function formatPostText(text) {
  if (!text) return '';
  
  // 1. Escape HTML to prevent XSS
  var tempDiv = document.createElement('div');
  tempDiv.textContent = text;
  var escaped = tempDiv.innerHTML;

  // 2. Parse Gantec email IDs inside markdown link syntax: @[user@gantecusa.com](mailto:user@gantecusa.com)
  escaped = escaped.replace(/@\[([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\]\(mailto:\1\)/gi, function(match, email) {
    return '<span class="social-tag-email" style="color:#3b82f6;font-weight:650;cursor:pointer;" title="' + email + '">@' + email + '</span>';
  });

  // 3. Parse plain Gantec email IDs preceded by @: e.g. @user@gantecusa.com
  escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9._%+-]+@gantecusa\.com)/gi, function(match, space, email) {
    return space + '<span class="social-tag-email" style="color:#3b82f6;font-weight:650;cursor:pointer;" title="' + email + '">@' + email + '</span>';
  });

  // 4. Parse regular @mentions (e.g. @john_doe, @mary)
  escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9._@-]+)/g, function(match, space, username) {
    return space + '<span class="social-tag-mention" style="color:#3b82f6;font-weight:650;cursor:pointer;">@' + username + '</span>';
  });

  // 5. Parse #tags (e.g. #gantec, #ideas) and #email tags
  // Email-like hashtags (e.g. #user@gantecusa.com)
  escaped = escaped.replace(/(^|\s)#([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, function(match, space, email) {
    return space + '<span class="social-tag-hashtag" style="color:#10b981;font-weight:650;cursor:pointer;" title="' + email + '">#' + email + '</span>';
  });
  // Regular hashtags (e.g. #gantec, #ideas) - exclude email tags
  escaped = escaped.replace(/(^|\s)#([a-zA-Z0-9._@-]+)/g, function(match, space, tag) {
    // Skip if tag looks like an email (contains @ and a dot after)
    if (/@/.test(tag) && /\./.test(tag)) return match;
    return space + '<span class="social-tag-hashtag" style="color:#10b981;font-weight:650;cursor:pointer;">#' + tag + '</span>';
  });

  return escaped;
}

function renderSocialFeed() {
  var container = document.getElementById('social-feed-scroll');
  if (!container) return;

  if (globalSocialPosts.length === 0) {
    container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888;">' +
      '<div style="font-size:3rem;margin-bottom:12px;">📸</div>' +
      '<p style="margin:0;font-size:0.95rem;">No posts yet.<br>Click <b>+ Post</b> to share an update!</p>' +
      '</div>';
    return;
  }

  var userEmail = (localStorage.getItem('gantec_user_email') || '').trim().toLowerCase();
  var html = '';

  for (var i = 0; i < globalSocialPosts.length; i++) {
    var post = globalSocialPosts[i];
    var isLiked = post.likedBy && post.likedBy.includes(userEmail);
    var heartFill = isLiked ? '#ff2442' : 'none';
    var heartStroke = isLiked ? '#ff2442' : 'currentColor';
    var displayName = post.fullname || (post.user_email ? post.user_email.split('@')[0] : 'User');
    var initials = displayName.substring(0, 2).toUpperCase();
    var isOwner = userEmail && post.user_email && post.user_email.trim().toLowerCase() === userEmail;

    var avatarHtml;
    if (post.profile_image) {
      avatarHtml = '<img src="' + post.profile_image + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
    } else {
      avatarHtml = '<div style="background:linear-gradient(135deg,#4f46e5,#ec4899);width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">' + initials + '</div>';
    }

    // Only show image container if there is an image
    var imageSection = '';
    if (post.image_url) {
      imageSection = '<div class="post-image-container">' +
        '<img src="' + post.image_url + '" class="post-image" ondblclick="toggleSocialLike(\'' + post.id + '\')" style="width:100%;display:block;max-height:300px;object-fit:cover;">' +
      '</div>';
    }

    var commentsHtml = '';
    if (post.comments && post.comments.length > 0) {
      for (var j = 0; j < post.comments.length; j++) {
        var c = post.comments[j];
        var cName = c.user_name || (c.user_email ? c.user_email.split('@')[0] : 'user');
        commentsHtml += '<div class="comment-item" style="font-size:0.85rem;margin-bottom:4px;"><span class="comment-username" style="font-weight:600;margin-right:5px;">' + cName + '</span>' + formatPostText(c.comment_text) + '</div>';
      }
    }

    var timeStr = '';
    try { timeStr = new Date(post.created_at).toLocaleString([], {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}); } catch(e) {}

    // Delete button - only for the post owner
    var deleteBtn = '';
    if (isOwner) {
      deleteBtn = '<button onclick="deleteSocialPost(\'' + post.id + '\')" title="Delete post" style="background:none;border:none;cursor:pointer;padding:4px 6px;color:#9ca3af;font-size:0.85rem;transition:color 0.2s;" onmouseover="this.style.color=\'#ef4444\'" onmouseout="this.style.color=\'#9ca3af\'">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
      '</button>';
    }

    html += '<div class="insta-post-card">' +
      '<div class="post-header">' +
        '<div class="post-user-info">' +
          '<div class="post-user-avatar" style="padding:0;overflow:hidden;">' + avatarHtml + '</div>' +
          '<div><div class="post-username">' + displayName + '</div><div class="post-location">' + timeStr + '</div></div>' +
        '</div>' +
        deleteBtn +
      '</div>' +
      imageSection +
      '<div class="post-details" style="padding:10px 14px;">' +
        (post.caption ? '<div class="post-caption" style="margin-bottom:8px;"><span class="caption-username" style="font-weight:700;margin-right:5px;">' + displayName + '</span>' + formatPostText(post.caption) + '</div>' : '') +
        '<div class="post-actions" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">' +
          '<button onclick="toggleSocialLike(\'' + post.id + '\')" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">' +
            '<svg viewBox="0 0 24 24" fill="' + heartFill + '" stroke="' + heartStroke + '" stroke-width="2" style="width:22px;height:22px;transition:all 0.2s;">' +
              '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' +
            '</svg>' +
            '<span style="font-size:0.85rem;font-weight:600;color:#374151;">' + (post.likesCount || 0) + '</span>' +
          '</button>' +
          '<button onclick="focusSocialComment(\'' + post.id + '\')" style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;">' +
              '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="comments-section" style="margin-top:4px;">' + commentsHtml + '</div>' +
        '<form onsubmit="submitSocialComment(event,\'' + post.id + '\')" style="display:flex;gap:8px;border-top:1px solid #efefef;padding-top:10px;margin-top:8px;">' +
          '<input type="text" id="cmt-' + post.id + '" placeholder="Add a comment..." autocomplete="off" style="flex:1;border:none;outline:none;font-size:0.9rem;background:transparent;" />' +
          '<button type="submit" style="background:none;border:none;color:#0ea5e9;font-weight:600;cursor:pointer;white-space:nowrap;">Post</button>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML = html;
}

function focusSocialComment(postId) {
  var el = document.getElementById('cmt-' + postId);
  if (el) el.focus();
}

async function toggleSocialLike(postId) {
  var user_email = localStorage.getItem('gantec_user_email');
  if (!user_email) { alert('Please log in'); return; }
  try {
    await fetch('/api/social/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, user_email: user_email })
    });
    loadSocialFeed();
  } catch(e) { console.error(e); }
}

async function submitSocialComment(e, postId) {
  e.preventDefault();
  var user_email = localStorage.getItem('gantec_user_email');
  if (!user_email) { alert('Please log in'); return; }
  var input = document.getElementById('cmt-' + postId);
  if (!input) return;
  var comment_text = input.value.trim();
  if (!comment_text) return;
  input.value = '';
  try {
    await fetch('/api/social/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, user_email: user_email, comment_text: comment_text })
    });
    loadSocialFeed();
  } catch(e) { console.error(e); }
}

async function deleteSocialPost(postId) {
  var user_email = localStorage.getItem('gantec_user_email');
  if (!user_email) return;

  // Custom confirmation modal
  var existing = document.getElementById('social-delete-modal');
  if (existing) document.body.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'social-delete-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

  overlay.innerHTML = '<div style="background:white;width:320px;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.3);animation:slideUp 0.25s ease;">' +
    '<div style="padding:28px 24px 16px;text-align:center;">' +
      '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#fef2f2,#fee2e2);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="width:26px;height:26px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>' +
      '</div>' +
      '<h3 style="margin:0 0 6px;font-size:1.1rem;color:#1f2937;font-weight:700;">Delete Post?</h3>' +
      '<p style="margin:0;font-size:0.875rem;color:#6b7280;line-height:1.4;">This action cannot be undone. The post and all its comments will be permanently removed.</p>' +
    '</div>' +
    '<div style="display:flex;border-top:1px solid #f3f4f6;">' +
      '<button id="del-cancel-btn" style="flex:1;padding:14px;border:none;background:white;color:#374151;font-size:0.95rem;font-weight:600;cursor:pointer;border-bottom-left-radius:16px;transition:background 0.15s;">Cancel</button>' +
      '<button id="del-confirm-btn" style="flex:1;padding:14px;border:none;background:white;color:#ef4444;font-size:0.95rem;font-weight:600;cursor:pointer;border-left:1px solid #f3f4f6;border-bottom-right-radius:16px;transition:background 0.15s;">Delete</button>' +
    '</div>' +
  '</div>';

  document.body.appendChild(overlay);

  // Button handlers
  document.getElementById('del-cancel-btn').onclick = function() {
    document.body.removeChild(overlay);
  };
  overlay.onclick = function(e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  };
  document.getElementById('del-confirm-btn').onclick = async function() {
    document.body.removeChild(overlay);
    try {
      await fetch('/api/social/posts/' + postId, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: user_email })
      });
      loadSocialFeed();
    } catch(e) { console.error(e); }
  };
}

function openSocialCreateModal(type) {
  var existing = document.getElementById('social-create-modal');
  if (existing) document.body.removeChild(existing);

  var modal = document.createElement('div');
  modal.id = 'social-create-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

  modal.innerHTML = '<div style="background:white;width:90%;max-width:420px;border-radius:18px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #f0f0f0;background:linear-gradient(135deg,#4f46e5,#0ea5e9);">' +
      '<h3 style="margin:0;font-size:1.1rem;color:white;font-weight:700;">Create Post</h3>' +
      '<button onclick="document.getElementById(\'social-create-modal\').style.display=\'none\'" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:1.3rem;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>' +
    '</div>' +
    '<div style="padding:20px;">' +
      '<div style="margin-bottom:14px;">' +
        '<label style="display:block;margin-bottom:6px;font-size:0.875rem;color:#374151;font-weight:600;">Image URL <span style="color:#9ca3af;font-weight:400;">(optional)</span></label>' +
        '<input type="text" id="social-image-url" placeholder="https://example.com/photo.jpg" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;outline:none;font-size:0.9rem;box-sizing:border-box;" />' +
      '</div>' +
      '<div style="margin-bottom:18px;">' +
        '<label style="display:block;margin-bottom:6px;font-size:0.875rem;color:#374151;font-weight:600;">Caption</label>' +
        '<textarea id="social-caption-text" rows="3" placeholder="What\'s on your mind?" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;outline:none;font-size:0.9rem;resize:none;box-sizing:border-box;"></textarea>' +
      '</div>' +
      '<button onclick="submitSocialCreate()" style="width:100%;padding:13px;background:linear-gradient(135deg,#4f46e5,#0ea5e9);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:1rem;">Share Post</button>' +
    '</div>' +
  '</div>';

  document.body.appendChild(modal);
}

async function submitSocialCreate() {
  var user_email = localStorage.getItem('gantec_user_email');
  var image_url = (document.getElementById('social-image-url') || {}).value || '';
  var text = (document.getElementById('social-caption-text') || {}).value || '';
  image_url = image_url.trim();
  text = text.trim();

  if (!user_email) { alert('Please log in'); return; }
  if (!text && !image_url) { alert('Please add an image URL or some text.'); return; }

  var modal = document.getElementById('social-create-modal');
  if (modal) modal.style.display = 'none';

  try {
    await fetch('/api/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: user_email, image_url: image_url, caption: text })
    });
    loadSocialFeed();
  } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('insta-widget-container')) {
    loadSocialFeed();
    // Start background polling for dynamic notification count updates
    setInterval(loadSocialFeed, 10000);
  }
});
