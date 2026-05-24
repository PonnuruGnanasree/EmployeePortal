// Gantec Idea Hub - Global State
var globalSocialPosts = [];
var globalUnreadMentionsCount = 0;
var globalMentionsList = [];
var socialLastSeenPostCount = parseInt(localStorage.getItem('social_seen_post_count') || '0');

async function loadSocialFeed() {
  try {
    var res = await fetch('/api/social/feed');
    var data = await res.json();
    if (data.success) {
      globalSocialPosts = data.posts;
      await loadSocialNotifications();
      renderSocialFeed();
    }
  } catch(e) {
    console.error('Social feed error:', e);
  }
}

function getNewPostsCount() {
  // Count posts from others that have not been seen yet
  var total = globalSocialPosts.length;
  return Math.max(0, total - socialLastSeenPostCount);
}

async function loadSocialNotifications() {
  var userEmail = (localStorage.getItem('gantec_user_email') || '').trim().toLowerCase();
  if (!userEmail) return;

  try {
    var res = await fetch('/api/social/notifications?email=' + encodeURIComponent(userEmail));
    var data = await res.json();
    if (data.success) {
      globalUnreadMentionsCount = data.count;
      globalMentionsList = data.notifications;
      updateSocialBadge();
    }
  } catch (e) {
    console.error('Failed to load social notifications:', e);
    updateSocialBadge();
  }
}

function updateSocialBadge() {
  var badge = document.getElementById('social-badge');
  if (!badge) return;

  // If widget is open, clear the new-posts counter (mark posts as seen)
  if (typeof instaWidgetOpen !== 'undefined' && instaWidgetOpen) {
    socialLastSeenPostCount = globalSocialPosts.length;
    localStorage.setItem('social_seen_post_count', String(socialLastSeenPostCount));
    if (globalUnreadMentionsCount > 0) {
      markMentionsAsRead();
    }
    badge.style.display = 'none';
    return;
  }

  // Badge = unread notifications (mentions, comments, messages)
  var totalBadge = globalUnreadMentionsCount;

  if (totalBadge > 0) {
    badge.textContent = totalBadge;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function markMentionsAsRead() {
  var userEmail = (localStorage.getItem('gantec_user_email') || '').trim().toLowerCase();
  if (!userEmail) return;

  try {
    var res = await fetch('/api/social/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail })
    });
    var data = await res.json();
    if (data.success) {
      globalUnreadMentionsCount = 0;
      globalMentionsList.forEach(function(m) { m.is_read = 1; });
      var badge = document.getElementById('social-badge');
      if (badge) badge.style.display = 'none';
    }
  } catch (e) {
    console.error('Failed to mark mentions as read:', e);
  }
}

function markPostsAsSeen() {
  // Called when Gantec Idea Hub widget is opened
  socialLastSeenPostCount = globalSocialPosts.length;
  localStorage.setItem('social_seen_post_count', String(socialLastSeenPostCount));
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
    return '<span class="social-tag-email" style="color:#3b82f6;font-weight:650;cursor:pointer;" title="' + email + '" onclick="window.location.href=\'insights.html?email=\' + encodeURIComponent(\'' + email + '\')">@' + email + '</span>';
  });

  // 3. Parse plain Gantec email IDs preceded by @: e.g. @user@gantecusa.com
  escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9._%+-]+@gantecusa\.com)/gi, function(match, space, email) {
    return space + '<span class="social-tag-email" style="color:#3b82f6;font-weight:650;cursor:pointer;" title="' + email + '" onclick="window.location.href=\'insights.html?email=\' + encodeURIComponent(\'' + email + '\')">@' + email + '</span>';
  });

  // 4. Parse regular @mentions (e.g. @john_doe, @mary)
  escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9._-]+)/g, function(match, space, username) {
    return space + '<span class="social-tag-mention" style="color:#3b82f6;font-weight:650;cursor:pointer;" title="@' + username + '" onclick="window.location.href=\'insights.html?email=\' + encodeURIComponent(\'' + username + '@gantecusa.com\')">@' + username + '</span>';
  });

  return escaped;
}

function renderSocialFeed() {
  var container = document.getElementById('social-feed-scroll');
  if (!container) return;

  var userEmail = (localStorage.getItem('gantec_user_email') || '').trim().toLowerCase();
  var html = '';

  // Render Mentions and Tags card at the top if there are any mentions
  var mentionsHtml = '';
  if (globalMentionsList && globalMentionsList.length > 0) {
    mentionsHtml += '<div class="mentions-card-container" style="background:#ffffff;margin:12px;padding:16px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.06);border:1px solid #f1f5f9;">' +
      '<div style="display:flex;align-items:center;justify-content:between;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;box-shadow:0 4px 10px rgba(99,102,241,0.2);">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>' +
          '</div>' +
          '<span style="font-size:0.9rem;font-weight:750;color:#1e293b;letter-spacing:-0.2px;">Idea Hub Notifications</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">';

    var maxMentions = Math.min(globalMentionsList.length, 5);
    for (var mIdx = 0; mIdx < maxMentions; mIdx++) {
      var m = globalMentionsList[mIdx];
      var isUnread = !m.is_read;
      var dateStr = '';
      try {
        dateStr = new Date(m.created_at).toLocaleDateString([], {month:'short', day:'numeric'}) + ' ' + new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } catch(e) {}

      var displayMsg = m.message;
      if (m.reportee_email) {
        var senderEmail = m.reportee_email.toLowerCase();
        var senderUsername = senderEmail.split('@')[0];
        var emailRegex = new RegExp(senderEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        displayMsg = displayMsg.replace(emailRegex, senderUsername);
      }

      var senderName = m.sender_name || (m.reportee_email ? m.reportee_email.split('@')[0] : 'User');
      var initials = senderName.substring(0, 2).toUpperCase();
      var avatarHtml = '';
      if (m.sender_image) {
        avatarHtml = '<img src="' + m.sender_image + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1.5px solid #e2e8f0;box-shadow:0 2px 5px rgba(0,0,0,0.05);">';
      } else {
        avatarHtml = '<div style="background:linear-gradient(135deg,#6366f1,#ec4899);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;border:1.5px solid #e2e8f0;box-shadow:0 2px 5px rgba(0,0,0,0.05);">' + initials + '</div>';
      }

      mentionsHtml += '<div style="display:flex;align-items:start;gap:12px;padding:10px 0;' + (mIdx < maxMentions - 1 ? 'border-bottom:1px dashed #f1f5f9;' : '') + '">' +
        '<div style="position:relative;flex-shrink:0;">' +
          avatarHtml +
          (isUnread 
            ? '<span style="position:absolute;top:-2px;right:-2px;display:block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 6px #8b5cf6;border:1.5px solid #ffffff;"></span>'
            : '') +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:0.83rem;color:#1e293b;line-height:1.4;font-weight:550;">' + formatPostText(displayMsg) + '</div>' +
          '<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px;">' + dateStr + '</div>' +
        '</div>' +
      '</div>';
    }

    mentionsHtml += '</div>' +
    '</div>';
  }

  html += mentionsHtml;

  if (globalSocialPosts.length === 0) {
    html += '<div style="padding:40px 20px;text-align:center;color:#888;">' +
      '<div style="font-size:3rem;margin-bottom:12px;">📸</div>' +
      '<p style="margin:0;font-size:0.95rem;">No posts yet.<br>Click <b>+ Post</b> to share an update!</p>' +
      '</div>';
    container.innerHTML = html;
    return;
  }

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
      var images = [];
      if (post.image_url.startsWith('[') && post.image_url.endsWith(']')) {
        try {
          images = JSON.parse(post.image_url);
        } catch(e) {
          images = [post.image_url];
        }
      } else {
        images = [post.image_url];
      }

      if (images.length > 1) {
        var slidesHtml = '';
        for (var imgIdx = 0; imgIdx < images.length; imgIdx++) {
          slidesHtml += '<div style="flex:0 0 100%; scroll-snap-align:start; position:relative; overflow:hidden; height:250px;">' +
            '<img src="' + images[imgIdx] + '" class="post-image" ondblclick="toggleSocialLike(\'' + post.id + '\')" style="width:100%; height:250px; object-fit:cover; display:block;" />' +
            '<span style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.65); color:white; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:10px; backdrop-filter:blur(4px);">' + (imgIdx + 1) + '/' + images.length + '</span>' +
          '</div>';
        }

        imageSection = '<div class="post-image-carousel" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -webkit-overflow-scrolling:touch; width:100%; height:250px;">' +
          slidesHtml +
        '</div>';
      } else if (images.length === 1 && images[0]) {
        imageSection = '<div class="post-image-container">' +
          '<img src="' + images[0] + '" class="post-image" ondblclick="toggleSocialLike(\'' + post.id + '\')" style="width:100%; display:block; max-height:300px; object-fit:cover;">' +
        '</div>';
      }
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

  // Save any in-progress comment text before re-rendering
  var activeCommentId = null;
  var activeCommentValue = '';
  var activeEl = document.activeElement;
  if (activeEl && activeEl.id && activeEl.id.startsWith('cmt-')) {
    activeCommentId = activeEl.id;
    activeCommentValue = activeEl.value || '';
  }

  container.innerHTML = html;

  // Restore in-progress comment text after re-render
  if (activeCommentId && activeCommentValue) {
    var restored = document.getElementById(activeCommentId);
    if (restored) {
      restored.value = activeCommentValue;
      restored.focus();
      // Place cursor at the end
      restored.setSelectionRange(activeCommentValue.length, activeCommentValue.length);
    }
  }
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
      '<button onclick="document.getElementById(\'social-create-modal\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;font-size:1.3rem;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>' +
    '</div>' +
    '<div style="padding:20px;">' +
      '<div style="margin-bottom:14px;">' +
        '<label style="display:block;margin-bottom:6px;font-size:0.875rem;color:#374151;font-weight:600;">Images</label>' +
        '<input type="file" id="social-image-file" accept="image/*" multiple style="display:none;" />' +
        '<div id="social-upload-area" style="border:1.5px dashed #cbd5e1; border-radius:10px; padding:20px; text-align:center; cursor:pointer; background:#fafafa; transition:all 0.2s;">' +
          '<div id="social-upload-placeholder">' +
            '<span style="font-size:1.5rem; display:block; margin-bottom:6px;">📷</span>' +
            '<span style="font-size:0.85rem; color:#6b7280; font-weight:600;">Upload images from your device</span>' +
          '</div>' +
          '<div id="social-upload-preview-container" style="display:none;">' +
            '<div id="social-create-preview-row" style="display:flex; gap:10px; overflow-x:auto; padding-bottom:4px; align-items:center;"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:18px;">' +
        '<label style="display:block;margin-bottom:6px;font-size:0.875rem;color:#374151;font-weight:600;">Caption</label>' +
        '<textarea id="social-caption-text" rows="3" placeholder="What\'s on your mind?" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;outline:none;font-size:0.9rem;resize:none;box-sizing:border-box;"></textarea>' +
      '</div>' +
      '<button onclick="submitSocialCreate()" style="width:100%;padding:13px;background:linear-gradient(135deg,#4f46e5,#0ea5e9);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:1rem;">Share Post</button>' +
    '</div>' +
  '</div>';

  document.body.appendChild(modal);

  // Setup upload elements
  var uploadArea = document.getElementById('social-upload-area');
  var fileInput = document.getElementById('social-image-file');
  var placeholder = document.getElementById('social-upload-placeholder');
  var previewContainer = document.getElementById('social-upload-preview-container');
  var previewRow = document.getElementById('social-create-preview-row');

  window.socialUploadedImages = [];

  function updateUploadedImagesPreview() {
    if (window.socialUploadedImages.length === 0) {
      placeholder.style.display = 'block';
      previewContainer.style.display = 'none';
      uploadArea.style.borderColor = '#cbd5e1';
      uploadArea.style.padding = '20px';
      return;
    }

    placeholder.style.display = 'none';
    previewContainer.style.display = 'block';
    uploadArea.style.borderColor = '#10b981';
    uploadArea.style.padding = '12px';

    var previewHtml = '';
    for (var i = 0; i < window.socialUploadedImages.length; i++) {
      previewHtml += '<div style="position:relative; width:80px; height:80px; flex-shrink:0;">' +
        '<img src="' + window.socialUploadedImages[i] + '" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" />' +
        '<button class="social-remove-thumb-btn" data-index="' + i + '" style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">&times;</button>' +
      '</div>';
    }

    // Add More Card
    previewHtml += '<div id="social-add-more-thumb" style="width:80px; height:80px; border:1.5px dashed #cbd5e1; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#ffffff; flex-shrink:0; cursor:pointer; transition:all 0.2s;">' +
      '<span style="font-size:1.2rem; color:#6b7280;">+</span>' +
      '<span style="font-size:0.65rem; color:#6b7280; font-weight:600;">Add More</span>' +
    '</div>';

    previewRow.innerHTML = previewHtml;

    // Attach listener for delete buttons
    previewRow.querySelectorAll('.social-remove-thumb-btn').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var index = parseInt(btn.dataset.index);
        window.socialUploadedImages.splice(index, 1);
        updateUploadedImagesPreview();
      };
    });

    // Attach listener for add more button
    var addMoreCard = document.getElementById('social-add-more-thumb');
    if (addMoreCard) {
      addMoreCard.onclick = function(e) {
        e.stopPropagation();
        fileInput.click();
      };
    }
  }

  uploadArea.onclick = function(e) {
    if (e.target.closest('#social-create-preview-row')) return;
    fileInput.click();
  };

  fileInput.onchange = function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;

    var loadedCount = 0;
    var totalFiles = files.length;

    for (var fIdx = 0; fIdx < totalFiles; fIdx++) {
      var file = files[fIdx];
      if (file.size > 2 * 1024 * 1024) {
        if (typeof showToast === 'function') {
          showToast('File "' + file.name + '" is too large. Max size is 2MB.', 'error');
        } else {
          alert('File "' + file.name + '" is too large. Max size is 2MB.');
        }
        continue;
      }

      var reader = new FileReader();
      reader.onload = (function(currFile) {
        return function(ev) {
          window.socialUploadedImages.push(ev.target.result);
          loadedCount++;
          if (loadedCount === totalFiles || loadedCount + window.socialUploadedImages.length >= 10) {
            updateUploadedImagesPreview();
          }
        };
      })(file);
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  };
}

async function submitSocialCreate() {
  var user_email = localStorage.getItem('gantec_user_email');
  var text = (document.getElementById('social-caption-text') || {}).value || '';
  text = text.trim();

  if (!user_email) { alert('Please log in'); return; }
  
  var image_url = '';
  if (window.socialUploadedImages && window.socialUploadedImages.length > 0) {
    image_url = JSON.stringify(window.socialUploadedImages);
  }

  if (!text && !image_url) { alert('Please upload at least one image or write a caption.'); return; }

  var modal = document.getElementById('social-create-modal');
  if (modal) modal.remove();

  try {
    await fetch('/api/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: user_email, image_url: image_url, caption: text })
    });
    await loadSocialFeed();
    var scrollContainer = document.getElementById('social-feed-scroll');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  } catch(e) { console.error(e); }
}

(function() {
  var style = document.createElement('style');
  style.innerHTML = 
    '.post-image-carousel::-webkit-scrollbar { display: none !important; }\n' +
    '.post-image-carousel { -ms-overflow-style: none; scrollbar-width: none; }\n' +
    '#social-create-preview-row::-webkit-scrollbar { display: none !important; }\n' +
    '#social-create-preview-row { -ms-overflow-style: none; scrollbar-width: none; }\n' +
    '#social-mention-dropdown { position:fixed; z-index:999999; background:white; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.15); max-height:220px; overflow-y:auto; min-width:220px; }\n' +
    '.social-mention-item { display:flex; align-items:center; gap:10px; padding:9px 14px; cursor:pointer; font-size:0.88rem; transition:background 0.15s; }\n' +
    '.social-mention-item:hover, .social-mention-item.active { background:#f0f4ff; }\n' +
    '.social-mention-avatar { width:32px; height:32px; border-radius:50%; object-fit:cover; background:linear-gradient(135deg,#4f46e5,#ec4899); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.78rem; flex-shrink:0; }\n' +
    '.social-mention-info { display:flex; flex-direction:column; }\n' +
    '.social-mention-name { font-weight:600; color:#1e293b; }\n' +
    '.social-mention-handle { color:#64748b; font-size:0.78rem; }';
  document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('insta-widget-container')) {
    loadSocialFeed();
    setInterval(loadSocialFeed, 10000);
  }
});

// ─── @Mention Autocomplete Engine ────────────────────────────────────────────
(function() {
  var dropdown = null;
  var activeInput = null;
  var mentionStart = -1;
  var activeIndex = -1;
  var currentSuggestions = [];
  var debounceTimer = null;

  function createDropdown() {
    var el = document.getElementById('social-mention-dropdown');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'social-mention-dropdown';
    document.body.appendChild(el);
    dropdown = el;
    return el;
  }

  function hideDropdown() {
    var el = document.getElementById('social-mention-dropdown');
    if (el) el.style.display = 'none';
    activeInput = null;
    mentionStart = -1;
    activeIndex = -1;
    currentSuggestions = [];
  }

  function positionDropdown(inputEl) {
    var rect = inputEl.getBoundingClientRect();
    var dd = document.getElementById('social-mention-dropdown');
    if (!dd) return;
    var spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 220) {
      dd.style.top = (rect.bottom + window.scrollY + 4) + 'px';
      dd.style.bottom = 'auto';
    } else {
      dd.style.top = 'auto';
      dd.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    }
    dd.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
  }

  function renderSuggestions(users) {
    currentSuggestions = users;
    activeIndex = -1;
    var dd = createDropdown();
    if (!users || users.length === 0) {
      dd.style.display = 'none';
      return;
    }
    dd.innerHTML = users.map(function(u, i) {
      var avatar = u.profile_image
        ? '<img class="social-mention-avatar" src="' + u.profile_image + '" />'
        : '<div class="social-mention-avatar">' + (u.fullname || u.username || '?').substring(0, 2).toUpperCase() + '</div>';
      return '<div class="social-mention-item" data-index="' + i + '">' +
        avatar +
        '<div class="social-mention-info">' +
          '<span class="social-mention-name">' + (u.fullname || u.username) + '</span>' +
          '<span class="social-mention-handle">@' + u.username + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
    dd.style.display = 'block';
    if (activeInput) positionDropdown(activeInput);

    dd.querySelectorAll('.social-mention-item').forEach(function(item) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        var idx = parseInt(item.dataset.index);
        insertMention(currentSuggestions[idx]);
      });
    });
  }

  function insertMention(user) {
    if (!activeInput) return;
    var val = activeInput.value;
    var before = val.substring(0, mentionStart);
    var after = val.substring(activeInput.selectionStart);
    var inserted = '@' + user.username + ' ';
    activeInput.value = before + inserted + after;
    var newCursor = (before + inserted).length;
    activeInput.setSelectionRange(newCursor, newCursor);
    activeInput.focus();
    hideDropdown();
  }

  function getMentionQuery(input) {
    var val = input.value;
    var pos = input.selectionStart;
    var textBefore = val.substring(0, pos);
    // Find the last @ before cursor that is at start or preceded by whitespace
    var match = textBefore.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (match) {
      mentionStart = textBefore.lastIndexOf('@');
      return match[2]; // the query part after @
    }
    return null;
  }

  async function fetchSuggestions(query) {
    try {
      var res = await fetch('/api/social/users/search?q=' + encodeURIComponent(query));
      var data = await res.json();
      return data.users || [];
    } catch(e) {
      return [];
    }
  }

  // Global input handler using event delegation
  document.addEventListener('input', function(e) {
    var target = e.target;
    if (!target) return;
    var isCaptionOrComment = (
      target.id === 'social-caption-text' ||
      (target.id && target.id.startsWith('cmt-'))
    );
    if (!isCaptionOrComment) { hideDropdown(); return; }

    activeInput = target;
    var query = getMentionQuery(target);
    if (query === null) {
      hideDropdown();
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async function() {
      var users = await fetchSuggestions(query);
      renderSuggestions(users);
    }, 180);
  });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    var dd = document.getElementById('social-mention-dropdown');
    if (!dd || dd.style.display === 'none') return;
    var items = dd.querySelectorAll('.social-mention-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      items.forEach(function(it, i) { it.classList.toggle('active', i === activeIndex); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      items.forEach(function(it, i) { it.classList.toggle('active', i === activeIndex); });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      insertMention(currentSuggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  // Hide when clicking outside
  document.addEventListener('mousedown', function(e) {
    var dd = document.getElementById('social-mention-dropdown');
    if (dd && !dd.contains(e.target)) {
      hideDropdown();
    }
  });

  // Reposition on scroll/resize
  window.addEventListener('scroll', function() {
    if (activeInput) positionDropdown(activeInput);
  }, true);
  window.addEventListener('resize', function() {
    if (activeInput) positionDropdown(activeInput);
  });
})();
