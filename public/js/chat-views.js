/* ASCEND — Stage 2: Chat UI views (thread list, global/thread search, pins, archive, context triggers). */
window.LM = window.LM || {};

(function () {
  const E = LM.esc, I = LM.icon, T = LM.t;

  const st = {
    listQuery: '',
    archiveOpen: false,
    search: {
      open: false,
      threadId: '',
      q: '',
      activeIdx: 0
    },
    focusMsgId: null,
    draftAttachment: null,
    attachError: '',
    profileOverlay: {
      mentorId: null,
      savedFeedScrollTop: null,
      pushedHistory: false,
      closingHistory: false
    }
  };

  function formatAttachmentMeta(att) {
    if (!att) return { fmt: 'IMG', kb: 1 };
    const m = String(att.mimeType || '').toLowerCase();
    const fmt = m === 'image/png' ? 'PNG' : m === 'image/webp' ? 'WEBP' : 'JPEG';
    const kb = Math.max(1, Math.round((Number(att.sizeBytes) || 1024) / 1024));
    return { fmt: fmt, kb: kb };
  }

  function messagePreviewSnippet(msg) {
    if (!msg) return '';
    if (msg.text) return msg.text;
    if (msg.attachment && msg.attachment.kind === 'image') return '[' + T('chat.attach.photoTag') + ']';
    return '';
  }

  function dateKeyOf(ts) {
    return LM.Game.dateKey(new Date(ts));
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat(LM.I18n.locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    } catch (e) {
      const d = new Date(ts);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
  }

  function formatListTime(ts) {
    if (!ts) return '';
    const today = LM.Game.dateKey();
    const k = dateKeyOf(ts);
    if (k === today) return formatTime(ts);
    return LM.dateLabel(k);
  }

  function avatarMarkup(charMeta, sizeCls) {
    return '<span class="chat-av ' + (sizeCls || '') + ' chat-av-' + E(charMeta.accent) + '">' +
      '<img src="' + E(charMeta.avatar) + '" alt="' + E(T(charMeta.nameKey)) + '" loading="lazy">' +
    '</span>';
  }

  function senderBadgeName(msg) {
    if (msg.sender === 'chico') return T('chat.char.chico.name');
    if (msg.sender === 'barrett') return T('chat.char.barrett.name');
    return '';
  }

  function senderAvatar(msg, fallbackMeta) {
    if (msg.sender === 'chico') return LM.CHAT_CHARS.chico;
    if (msg.sender === 'barrett') return LM.CHAT_CHARS.barrett;
    return fallbackMeta;
  }

  function highlightText(rawText, query, isActive) {
    const text = String(rawText == null ? '' : rawText);
    const q = String(query || '').trim();
    if (!q) return E(text);
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    let idx = lowerText.indexOf(lowerQ);
    if (idx < 0) return E(text);
    let out = '';
    let pos = 0;
    const cls = isActive ? 'chat-hl active' : 'chat-hl';
    while (idx >= 0) {
      if (idx > pos) out += E(text.slice(pos, idx));
      out += '<mark class="' + cls + '">' + E(text.slice(idx, idx + q.length)) + '</mark>';
      pos = idx + q.length;
      idx = lowerText.indexOf(lowerQ, pos);
    }
    if (pos < text.length) out += E(text.slice(pos));
    return out;
  }

  function snippetAround(rawText, query) {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    const q = String(query || '').trim();
    if (!q || text.length <= 130) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text.slice(0, 128) + '…';
    const start = Math.max(0, idx - 36);
    const end = Math.min(text.length, idx + q.length + 76);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function renderFollowUps(items, cls) {
    if (!items || !items.length) return '';
    return '<div class="' + (cls || 'chat-followups') + '">' +
      items.map(text =>
        '<button type="button" class="chat-chip" data-act="chat-followup" data-prompt="' + E(text) + '" aria-label="' + E(T('chat.followupAria', { prompt: text })) + '">' + E(text) + '</button>'
      ).join('') +
    '</div>';
  }

  function renderMentorProfileHtml(profile) {
    if (!profile) return '';
    const initial = E((profile.displayName || profile.shortName || '?').trim().charAt(0).toUpperCase() || '?');
    const photoSrc = profile.photo || profile.avatar || '';
    const fallbackSrc = profile.avatar && profile.avatar !== photoSrc ? profile.avatar : '';
    const onErrAttr = fallbackSrc
      ? ' onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + E(fallbackSrc) + '\';}else{this.style.display=\'none\';this.parentNode.classList.add(\'no-photo\');}"'
      : ' onerror="this.style.display=\'none\';this.parentNode.classList.add(\'no-photo\');"';

    const specsHtml = (profile.specializations || []).length
      ? '<section class="mentor-prof-card">' +
          '<h2 class="mentor-prof-sec-title">' + E(T('chat.profile.section.specializations')) + '</h2>' +
          '<ul class="mentor-prof-spec-list">' +
            profile.specializations.map(item =>
              '<li class="mentor-prof-spec-item">' + I('check', { size: 14 }) + '<span>' + E(item) + '</span></li>'
            ).join('') +
          '</ul>' +
        '</section>'
      : '';

    const principlesHtml = (profile.principles || []).length
      ? '<section class="mentor-prof-card">' +
          '<h2 class="mentor-prof-sec-title">' + E(T('chat.profile.section.principles')) + '</h2>' +
          '<ol class="mentor-prof-principles">' +
            profile.principles.map((item, idx) =>
              '<li class="mentor-prof-principle">' +
                '<span class="mentor-prof-pidx">' + String(idx + 1).padStart(2, '0') + '</span>' +
                '<span class="mentor-prof-ptxt">' + E(item) + '</span>' +
              '</li>'
            ).join('') +
          '</ol>' +
        '</section>'
      : '';

    return '<div class="mentor-prof-shell chat-theme-' + E(profile.accent || 'barrett') + '">' +
      '<div class="mentor-prof-topbar">' +
        '<button type="button" class="backbtn mentor-prof-back" id="mentor-profile-back" data-act="close-mentor-profile" aria-label="' + E(T('chat.profile.backAria')) + '">' +
          I('back') +
          '<span>' + E(T('chat.profile.backLabel')) + '</span>' +
        '</button>' +
        '<span class="mentor-prof-topbar-title">' + E(profile.displayName) + '</span>' +
        '<span class="mentor-prof-topbar-spacer" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="mentor-prof-hero">' +
        '<div class="mentor-prof-hero-fallback" aria-hidden="true">' + initial + '</div>' +
        (photoSrc
          ? '<img class="mentor-prof-photo" src="' + E(photoSrc) + '" alt="' + E(profile.displayName) + '"' + onErrAttr + '>'
          : '') +
        '<div class="mentor-prof-hero-fade" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="mentor-prof-body">' +
        '<div class="mentor-prof-ident">' +
          '<h1 class="mentor-prof-name">' + E(profile.displayName) + '</h1>' +
          '<p class="mentor-prof-status">' + E(profile.status) + '</p>' +
        '</div>' +
        '<section class="mentor-prof-card">' +
          '<h2 class="mentor-prof-sec-title">' + E(T('chat.profile.section.about')) + '</h2>' +
          '<p class="mentor-prof-copy">' + E(profile.personality) + '</p>' +
          '<h3 class="mentor-prof-sub-title">' + E(T('chat.profile.section.bio')) + '</h3>' +
          '<p class="mentor-prof-copy dim-copy">' + E(profile.bio) + '</p>' +
        '</section>' +
        (profile.quote
          ? '<blockquote class="mentor-prof-quote" aria-label="' + E(T('chat.profile.section.quote')) + '">' +
              '<span class="mentor-prof-qmark" aria-hidden="true">“</span>' +
              '<p class="mentor-prof-qtext">' + E(profile.quote) + '</p>' +
            '</blockquote>'
          : '') +
        (profile.interestsLine
          ? '<section class="mentor-prof-card">' +
              '<h2 class="mentor-prof-sec-title">' + E(T('chat.profile.section.interests')) + '</h2>' +
              '<p class="mentor-prof-interests">' + E(profile.interestsLine) + '</p>' +
            '</section>'
          : '') +
        specsHtml +
        principlesHtml +
        '<div class="mentor-prof-cta-wrap">' +
          '<button type="button" class="btn mentor-prof-cta" data-act="close-mentor-profile">' +
            I('chat', { size: 17 }) +
            '<span>' + E(T('chat.profile.backToChat')) + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderThreadRow(item, opts) {
    opts = opts || {};
    const m = item.meta;
    const last = item.lastMessage;
    const busy = !!(LM.ChatAPI && LM.ChatAPI.isBusy(item.id));
    const preview = busy
      ? T('chat.typingPreview')
      : last
        ? ((last.status === 'error' ? T('chat.errorPreview') + ': ' : (last.role === 'user' ? T('chat.youPrefix') + ': ' : (item.id === 'duo' ? senderBadgeName(last) + ': ' : ''))) + messagePreviewSnippet(last))
        : T('chat.noMessagesYet');
    const timeStr = last ? formatListTime(last.ts) : '';
    const unreadHtml = item.unread > 0
      ? '<span class="chat-unread" aria-label="' + E(T('chat.unreadAria', { n: item.unread })) + '">' + (item.unread > 99 ? '99+' : item.unread) + '</span>'
      : '';
    const pinBadge = item.pinnedCount > 0
      ? '<span class="chat-row-pin" aria-label="' + E(T('chat.pin.barLabel', { n: item.pinnedCount })) + '">' + I('pin', { size: 11 }) + '<span>' + item.pinnedCount + '</span></span>'
      : '';
    const archBadge = item.archived
      ? '<span class="chat-arch-tag">' + E(T('chat.archive.badge')) + '</span>'
      : '';
    const restoreBtn = opts.showRestore && item.archived
      ? '<button type="button" class="chat-row-restore" data-act="thread-restore" data-thread-id="' + E(item.id) + '" aria-label="' + E(T('chat.menu.restore')) + '">' + I('restore', { size: 14 }) + '</button>'
      : '';

    return '<div class="card chat-row chat-theme-' + E(m.accent) + (item.archived ? ' is-archived' : '') + '" data-chat-id="' + E(item.id) + '">' +
      '<a class="chat-row-main" href="#/chat/' + E(item.id) + '">' +
        avatarMarkup(m, 'md') +
        '<div class="chat-row-body">' +
          '<div class="chat-row-top">' +
            '<span class="chat-row-title-wrap"><span class="chat-row-name">' + E(item.title) + '</span>' + archBadge + pinBadge + '</span>' +
            '<span class="chat-row-time">' + E(timeStr) + '</span>' +
          '</div>' +
          '<div class="chat-row-role">' + E(T(m.roleKey)) + '</div>' +
          '<div class="chat-row-foot">' +
            '<span class="chat-row-prev' + (busy ? ' typing' : (!last ? ' muted' : (last.status === 'error' ? ' is-error' : ''))) + '">' + E(preview) + '</span>' +
            unreadHtml +
          '</div>' +
        '</div>' +
      '</a>' +
      '<div class="chat-row-actions">' +
        restoreBtn +
        '<button type="button" class="chat-row-menu" data-act="thread-menu" data-thread-id="' + E(item.id) + '" aria-label="' + E(T('chat.threadMenuAria')) + '">' + I('dots', { size: 17 }) + '</button>' +
      '</div>' +
    '</div>';
  }

  function listBodyHtml() {
    const threads = LM.ChatStore.listThreads();
    const q = String(st.listQuery || '').trim();
    const ql = q.toLowerCase();

    if (ql) {
      const matchedThreads = threads.filter(item =>
        item.title.toLowerCase().indexOf(ql) >= 0 ||
        T(item.meta.roleKey).toLowerCase().indexOf(ql) >= 0 ||
        (item.lastMessage && item.lastMessage.text.toLowerCase().indexOf(ql) >= 0)
      );
      const hits = LM.ChatStore.searchMessages(q, { includeArchived: true });
      if (!matchedThreads.length && !hits.length) {
        return '<div class="empty"><b>' + E(T('guides.emptySearchTitle')) + '</b>' + E(T('chat.search.noResults')) + '</div>';
      }
      let out = '';
      if (matchedThreads.length) {
        out += '<div class="chat-sec-lbl">' + E(T('chat.search.dialogsTitle', { n: matchedThreads.length })) + '</div>' +
          '<div class="chat-list" id="chat-list">' +
            matchedThreads.map(item => renderThreadRow(item, { showRestore: true })).join('') +
          '</div>';
      }
      if (hits.length) {
        out += '<div class="chat-sec-lbl">' + E(T('chat.search.resultsTitle', { n: hits.length })) + '</div>' +
          '<div class="chat-hits">' +
            hits.slice(-40).reverse().map(hit => {
              const title = LM.ChatStore.getThreadTitle(hit.threadId);
              const meta = LM.CHAT_CHARS[hit.threadId];
              const th = LM.ChatStore.getThread(hit.threadId);
              const snippet = snippetAround(hit.msg.text, q);
              return '<a class="card chat-hit" href="#/chat/' + E(hit.threadId) + '?focus=' + encodeURIComponent(hit.msg.id) + '" data-chat-id="' + E(hit.threadId) + '" data-msg-id="' + E(hit.msg.id) + '">' +
                avatarMarkup(meta, 'sm') +
                '<div class="chat-hit-body">' +
                  '<div class="chat-hit-top">' +
                    '<span class="chat-hit-name">' + E(title) + (th && th.archived ? ' <span class="chat-arch-tag">' + E(T('chat.archive.badge')) + '</span>' : '') + '</span>' +
                    '<span class="chat-row-time">' + E(formatListTime(hit.msg.ts)) + '</span>' +
                  '</div>' +
                  '<div class="chat-hit-txt">' + highlightText(snippet, q, false) + '</div>' +
                '</div>' +
              '</a>';
            }).join('') +
          '</div>';
      }
      return out;
    }

    const active = threads.filter(item => !item.archived);
    const archived = threads.filter(item => item.archived);

    let out = '';
    if (active.length) {
      out += '<div class="chat-list" id="chat-list">' +
        active.map(item => renderThreadRow(item, { showRestore: false })).join('') +
      '</div>';
    } else {
      out += '<div class="empty"><b>' + E(T('chat.archive.allArchivedTitle')) + '</b>' + E(T('chat.archive.allArchivedBody')) + '</div>';
    }

    if (archived.length) {
      const open = st.archiveOpen || active.length === 0;
      out += '<div class="chat-archive-sec">' +
        '<button type="button" class="chat-archive-toggle' + (open ? ' open' : '') + '" id="chat-archived-toggle" data-act="chat-toggle-archive" aria-expanded="' + open + '">' +
          '<span class="chat-archive-lbl">' + I('archive', { size: 15 }) + '<span>' + E(T('chat.archive.section', { n: archived.length })) + '</span></span>' +
          '<span class="chat-archive-chev">' + I('chevron', { size: 16 }) + '</span>' +
        '</button>' +
        (open
          ? '<div class="chat-list chat-archive-list" id="chat-archive-list">' +
              archived.map(item => renderThreadRow(item, { showRestore: true })).join('') +
            '</div>'
          : '') +
      '</div>';
    }

    return out;
  }

  function getThreadSearchMatches(threadId, msgs) {
    if (!st.search.open || st.search.threadId !== threadId) return [];
    const ql = String(st.search.q || '').trim().toLowerCase();
    if (!ql) return [];
    return (msgs || [])
      .filter(m => m && typeof m.text === 'string' && m.text.toLowerCase().indexOf(ql) >= 0)
      .map(m => m.id);
  }

  function searchMetaLabel(threadId, msgs) {
    if (!st.search.open || st.search.threadId !== threadId) return '';
    const q = String(st.search.q || '').trim();
    if (!q) return '';
    const matches = getThreadSearchMatches(threadId, msgs);
    if (!matches.length) return T('chat.search.noMatches');
    const idx = Math.max(0, Math.min(st.search.activeIdx || 0, matches.length - 1));
    return T('chat.search.matchCount', { cur: idx + 1, total: matches.length });
  }

  function feedHtml(threadId) {
    const meta = LM.CHAT_CHARS[threadId];
    const th = LM.ChatStore.getThread(threadId);
    const msgs = th ? th.messages : [];
    const pinnedSet = new Set(th && Array.isArray(th.pinnedIds) ? th.pinnedIds : []);
    const isBusy = !!(LM.ChatAPI && LM.ChatAPI.isBusy(threadId));
    const searchActive = st.search.open && st.search.threadId === threadId && String(st.search.q || '').trim().length > 0;
    const searchQuery = searchActive ? String(st.search.q || '').trim() : '';
    const matches = searchActive ? getThreadSearchMatches(threadId, msgs) : [];
    if (matches.length) {
      st.search.activeIdx = Math.max(0, Math.min(st.search.activeIdx || 0, matches.length - 1));
    } else {
      st.search.activeIdx = 0;
    }
    const activeMatchId = matches.length ? matches[st.search.activeIdx] : null;
    const highlightMsgId = st.focusMsgId || activeMatchId;

    let body = '';
    if (!msgs.length) {
      const hintText = threadId === 'barrett' ? T('chat.foundationHint') : T('chat.stage2Hint');
      const startersHtml = threadId === 'barrett'
        ? '<div class="chat-starters">' +
            ['chat.starter.1', 'chat.starter.2', 'chat.starter.3'].map(k =>
              '<button type="button" class="chat-chip" data-act="chat-starter" data-prompt="' + E(T(k)) + '">' + E(T(k)) + '</button>'
            ).join('') +
          '</div>'
        : '';
      body = '<div class="chat-empty-state">' +
        avatarMarkup(meta, 'lg') +
        '<h2 class="chat-empty-title">' + E(LM.ChatStore.getThreadTitle(threadId)) + '</h2>' +
        '<p class="chat-empty-role">' + E(T(meta.roleKey)) + '</p>' +
        '<p class="chat-empty-desc">' + E(T(meta.descKey)) + '</p>' +
        '<div class="chat-stage-pill">' + E(hintText) + '</div>' +
        startersHtml +
      '</div>';
    } else {
      let lastDateKey = '';
      body = msgs.map((msg, idx) => {
        const dk = dateKeyOf(msg.ts);
        let sep = '';
        if (dk !== lastDateKey) {
          lastDateKey = dk;
          sep = '<div class="chat-date-sep"><span>' + E(LM.dateLabel(dk)) + '</span></div>';
        }
        const isPinned = pinnedSet.has(msg.id);
        const isFocused = highlightMsgId && highlightMsgId === msg.id;
        const isMatched = searchActive && matches.indexOf(msg.id) >= 0;
        const editedSpan = msg.editedAt
          ? '<span class="chat-edited-tag">' + E(T('chat.editedTag')) + '</span>'
          : '';
        const pinSpan = isPinned
          ? '<span class="chat-pin-tag" title="' + E(T('chat.pinnedTag')) + '">' + I('pin', { size: 11 }) + '</span>'
          : '';
        const textHtml = highlightText(msg.text, searchQuery, activeMatchId === msg.id);
        const menuBtn = msg.status !== 'sending'
          ? '<button type="button" class="chat-msg-more" data-act="msg-menu" data-msg-id="' + E(msg.id) + '" aria-label="' + E(T('chat.msgMenuAria')) + '">' + I('dots', { size: 14 }) + '</button>'
          : '';

        if (msg.role === 'user') {
          const isErr = msg.status === 'error';
          const isSending = msg.status === 'sending';
          const errMsg = isErr ? ((msg.error && msg.error.message) || T('chat.err.generic')) : '';
          const canRetry = isErr && (!msg.error || msg.error.retryable !== false);
          const errHtml = isErr
            ? '<div class="chat-err-box" role="alert">' +
                '<span class="chat-err-txt">' + I('warning', { size: 14 }) + '<span>' + E(errMsg) + '</span></span>' +
                (canRetry
                  ? '<button type="button" class="chat-retry-btn" data-act="chat-retry" data-msg-id="' + E(msg.id) + '" aria-label="' + E(T('chat.retryAria')) + '"' + (isBusy ? ' disabled' : '') + '>' + I('refresh', { size: 13 }) + '<span>' + E(T('chat.retry')) + '</span></button>'
                  : '') +
              '</div>'
            : '';
          const statusSpan = isSending
            ? '<span class="chat-status sending">' + E(T('chat.sendingStatus')) + '</span>'
            : '';
          let attachHtml = '';
          if (msg.attachment && msg.attachment.kind === 'image') {
            const ramPreview = LM.ChatAPI && LM.ChatAPI.getSessionPreview ? LM.ChatAPI.getSessionPreview(msg.id) : '';
            if (ramPreview) {
              attachHtml = '<div class="chat-msg-media"><img class="chat-msg-img" src="' + E(ramPreview) + '" alt="' + E(T('chat.attach.photoTag')) + '"></div>';
            } else {
              const info = formatAttachmentMeta(msg.attachment);
              attachHtml = '<div class="chat-msg-file">' + I('image', { size: 14 }) + '<span>' + E(T('chat.attach.sentBadge', info)) + '</span></div>';
            }
          }
          const txtBlock = msg.text ? ('<div class="chat-txt">' + textHtml + '</div>') : '';
          return sep +
            '<div class="chat-msg out' + (isSending ? ' is-sending' : '') + (isErr ? ' is-error' : '') + (isPinned ? ' is-pinned' : '') + (isMatched ? ' is-match' : '') + (isFocused ? ' is-focused' : '') + '" data-msg-id="' + E(msg.id) + '">' +
              '<div class="chat-out-col">' +
                '<div class="chat-bubble out">' +
                  attachHtml +
                  txtBlock +
                  '<div class="chat-meta">' + pinSpan + editedSpan + statusSpan + '<span class="chat-time">' + E(formatTime(msg.ts)) + '</span>' + menuBtn + '</div>' +
                '</div>' +
                errHtml +
              '</div>' +
            '</div>';
        }

        const avMeta = senderAvatar(msg, meta);
        const sName = senderBadgeName(msg);
        const isLast = idx === msgs.length - 1;
        const fallbackHtml = msg.fallbackUsed === true
          ? '<div class="chat-fallback-note" role="note">' + I('info', { size: 12 }) + '<span>' + E(T('chat.fallbackNotice')) + '</span></div>'
          : '';
        const followUpsHtml = (isLast && !isBusy && threadId === 'barrett' && msg.followUps && msg.followUps.length)
          ? renderFollowUps(msg.followUps, 'chat-followups')
          : '';
        return sep +
          '<div class="chat-msg in chat-sender-' + E(avMeta.accent) + (isPinned ? ' is-pinned' : '') + (isMatched ? ' is-match' : '') + (isFocused ? ' is-focused' : '') + '" data-msg-id="' + E(msg.id) + '">' +
            avatarMarkup(avMeta, 'sm') +
            '<div class="chat-in-col">' +
              '<div class="chat-bubble in">' +
                '<div class="chat-bubble-top">' +
                  '<span class="chat-sender">' + E(sName) + '</span>' +
                  menuBtn +
                '</div>' +
                '<div class="chat-txt">' + textHtml + '</div>' +
                fallbackHtml +
                '<div class="chat-meta">' + pinSpan + editedSpan + '<span class="chat-time">' + E(formatTime(msg.ts)) + '</span></div>' +
              '</div>' +
              followUpsHtml +
            '</div>' +
          '</div>';
      }).join('');
    }

    if (isBusy && threadId === 'barrett') {
      body += '<div class="chat-msg in chat-typing chat-sender-barrett" id="chat-typing" aria-live="polite">' +
        avatarMarkup(LM.CHAT_CHARS.barrett, 'sm') +
        '<div class="chat-bubble in chat-bubble-typing">' +
          '<div class="chat-sender">' + E(T('chat.char.barrett.name')) + '</div>' +
          '<div class="chat-typing-row">' +
            '<span class="chat-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
            '<span class="chat-typing-txt">' + E(T('chat.typingLabel')) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    return body;
  }

  function renderAttachSlotHtml(threadId) {
    if (threadId !== 'barrett') return '';
    let out = '';
    if (st.attachError) {
      out += '<div class="chat-attach-err" id="chat-attach-err" role="alert">' +
        I('warning', { size: 14 }) +
        '<span>' + E(st.attachError) + '</span>' +
      '</div>';
    }
    if (st.draftAttachment) {
      const att = st.draftAttachment;
      const meta = formatAttachmentMeta(att);
      const label = att.name ? (att.name + ' · ' + meta.fmt + ' · ' + meta.kb + ' KB') : (T('chat.attach.photoTag') + ' · ' + meta.fmt + ' · ' + meta.kb + ' KB');
      out += '<div class="chat-attach-preview" id="chat-attach-preview">' +
        '<div class="chat-attach-row">' +
          (att.previewUrl ? '<img class="chat-attach-thumb" src="' + E(att.previewUrl) + '" alt="' + E(T('chat.attach.photoTag')) + '">' : '<div class="chat-attach-thumb chat-attach-thumb-ic">' + I('image', { size: 18 }) + '</div>') +
          '<div class="chat-attach-meta">' +
            '<div class="chat-attach-name">' + E(label) + '</div>' +
            '<label class="chat-attach-consent">' +
              '<input type="checkbox" id="chat-attach-consent"' + (att.consent ? ' checked' : '') + '>' +
              '<span>' + E(T('chat.attach.consentLabel')) + '</span>' +
            '</label>' +
          '</div>' +
          '<button type="button" class="chat-attach-rm" id="chat-attach-clear" data-act="chat-attach-clear" aria-label="' + E(T('chat.attach.removeAria')) + '">' + I('x', { size: 14 }) + '</button>' +
        '</div>' +
      '</div>';
    }
    return out;
  }

  LM.ChatViews = {
    st: st,

    setFocusMessage(msgId) {
      st.focusMsgId = msgId || null;
    },

    setDraftAttachment(att) {
      st.draftAttachment = att ? Object.assign({ consent: false }, att) : null;
      if (att) st.attachError = '';
    },

    setDraftConsent(checked) {
      if (st.draftAttachment) st.draftAttachment.consent = Boolean(checked);
      if (checked) st.attachError = '';
    },

    clearDraftAttachment() {
      st.draftAttachment = null;
      st.attachError = '';
    },

    setAttachError(msg) {
      st.attachError = String(msg || '');
    },

    refreshAttachSlot(threadId) {
      const slot = document.getElementById('chat-attach-slot');
      if (slot) slot.innerHTML = renderAttachSlotHtml(threadId || 'barrett');
    },

    resetThreadSearch(threadId) {
      st.search = {
        open: false,
        threadId: threadId || '',
        q: '',
        activeIdx: 0
      };
    },

    openThreadSearch(threadId) {
      if (st.search.threadId !== threadId) {
        st.search = { open: true, threadId: threadId, q: '', activeIdx: 0 };
      } else {
        st.search.open = true;
      }
    },

    stepSearchMatch(threadId, delta) {
      const msgs = LM.ChatStore.getMessages(threadId);
      const matches = getThreadSearchMatches(threadId, msgs);
      if (!matches.length) return null;
      const len = matches.length;
      st.search.activeIdx = ((st.search.activeIdx || 0) + delta + len) % len;
      st.focusMsgId = matches[st.search.activeIdx];
      return st.focusMsgId;
    },

    refreshList() {
      const bodyEl = document.getElementById('chat-list-body');
      if (bodyEl) bodyEl.innerHTML = listBodyHtml();
      const clr = document.getElementById('chat-global-clear');
      if (clr) clr.hidden = !String(st.listQuery || '').trim();
    },

    refreshFeed(threadId) {
      const th = LM.ChatStore.getThread(threadId);
      const msgs = th ? th.messages : [];
      const feed = document.getElementById('chat-feed');
      if (feed) feed.innerHTML = feedHtml(threadId);
      const metaEl = document.getElementById('chat-search-meta');
      if (metaEl) metaEl.textContent = searchMetaLabel(threadId, msgs);
      const clr = document.getElementById('chat-search-clear');
      if (clr) clr.hidden = !String(st.search.q || '').trim();
      const matches = getThreadSearchMatches(threadId, msgs);
      const prevBtn = document.getElementById('chat-match-prev');
      const nextBtn = document.getElementById('chat-match-next');
      if (prevBtn) prevBtn.disabled = matches.length <= 1;
      if (nextBtn) nextBtn.disabled = matches.length <= 1;
      this.scrollAfterPaint(threadId);
    },

    list() {
      const hasQ = Boolean(String(st.listQuery || '').trim());
      return '<div class="chat-list-wrap">' +
        '<div class="head chat-list-head">' +
          '<h1 class="h1">' + E(T('chat.title')) + '</h1>' +
          '<p class="sub">' + E(T('chat.sub')) + '</p>' +
        '</div>' +
        '<div class="chat-global-search">' +
          '<span class="chat-search-ic">' + I('search', { size: 16 }) + '</span>' +
          '<input type="search" class="chat-search-in" id="chat-global-q" value="' + E(st.listQuery) + '" placeholder="' + E(T('chat.search.globalPlaceholder')) + '" aria-label="' + E(T('chat.search.globalAria')) + '" autocomplete="off">' +
          '<button type="button" class="chat-search-clr" id="chat-global-clear" data-act="chat-global-clear" aria-label="' + E(T('chat.search.clearAria')) + '"' + (hasQ ? '' : ' hidden') + '>' + I('x', { size: 14 }) + '</button>' +
        '</div>' +
        '<div class="chat-list-body" id="chat-list-body">' + listBodyHtml() + '</div>' +
      '</div>';
    },

    thread(threadId) {
      if (!LM.ChatStore.isValidThread(threadId)) {
        return '<div class="chat-thread-wrap">' +
          '<div class="head"><a class="back" href="#/chat">' + I('back') + ' ' + E(T('chat.title')) + '</a></div>' +
          '<div class="empty"><b>' + E(T('chat.notFoundTitle')) + '</b>' + E(T('chat.notFoundSub')) + '</div>' +
        '</div>';
      }

      const meta = LM.CHAT_CHARS[threadId];
      const th = LM.ChatStore.getThread(threadId);
      const msgs = th ? th.messages : [];
      const isBusy = !!(LM.ChatAPI && LM.ChatAPI.isBusy(threadId));
      const title = LM.ChatStore.getThreadTitle(threadId);
      const searchOpen = st.search.open && st.search.threadId === threadId;
      const matches = searchOpen ? getThreadSearchMatches(threadId, msgs) : [];
      const pinned = LM.ChatStore.getPinnedMessages(threadId);
      const latestPin = pinned.length ? pinned[pinned.length - 1] : null;

      const stageNotice = (msgs.length && threadId !== 'barrett')
        ? '<div class="chat-stage-banner">' + E(T('chat.stage2Hint')) + '</div>'
        : '';

      const searchBarHtml = '<div class="chat-search-bar' + (searchOpen ? ' open' : '') + '" id="chat-search-wrap"' + (searchOpen ? '' : ' hidden') + '>' +
        '<div class="chat-search-field">' +
          I('search', { size: 14 }) +
          '<input type="search" class="chat-thread-qin" id="chat-thread-q" value="' + E(searchOpen ? st.search.q : '') + '" placeholder="' + E(T('chat.search.threadPlaceholder')) + '" aria-label="' + E(T('chat.search.threadAria')) + '" autocomplete="off">' +
          '<button type="button" class="chat-search-clr" id="chat-search-clear" data-act="chat-search-clear" aria-label="' + E(T('chat.search.clearAria')) + '"' + ((searchOpen && st.search.q) ? '' : ' hidden') + '>' + I('x', { size: 13 }) + '</button>' +
        '</div>' +
        '<div class="chat-search-nav">' +
          '<span class="chat-search-meta" id="chat-search-meta">' + E(searchMetaLabel(threadId, msgs)) + '</span>' +
          '<button type="button" class="chat-search-step" id="chat-match-prev" data-act="chat-match-prev" aria-label="' + E(T('chat.search.prevAria')) + '"' + (matches.length <= 1 ? ' disabled' : '') + '>' + I('back', { size: 14 }) + '</button>' +
          '<button type="button" class="chat-search-step" id="chat-match-next" data-act="chat-match-next" aria-label="' + E(T('chat.search.nextAria')) + '"' + (matches.length <= 1 ? ' disabled' : '') + '>' + I('chevron', { size: 14 }) + '</button>' +
        '</div>' +
      '</div>';

      const pinBarHtml = latestPin
        ? '<button type="button" class="chat-pin-bar" id="chat-pin-bar" data-act="chat-pinned-list">' +
            '<span class="chat-pin-ic">' + I('pin', { size: 14 }) + '</span>' +
            '<span class="chat-pin-copy">' +
              '<span class="chat-pin-lbl">' + E(T('chat.pin.barLabel', { n: pinned.length })) + '</span>' +
              '<span class="chat-pin-prev">' + E(messagePreviewSnippet(latestPin)) + '</span>' +
            '</span>' +
            '<span class="chat-pin-chev">' + I('chevron', { size: 15 }) + '</span>' +
          '</button>'
        : '';

      const restoreHeadBtn = th && th.archived
        ? '<button type="button" class="chat-head-restore" data-act="thread-restore" data-thread-id="' + E(threadId) + '">' + I('restore', { size: 13 }) + '<span>' + E(T('chat.archive.restoreShort')) + '</span></button>'
        : '';

      const isBarrett = threadId === 'barrett';
      const composerHtml = isBarrett
        ? '<div class="chat-composer-wrap" id="chat-composer-wrap">' +
            '<div id="chat-attach-slot">' + renderAttachSlotHtml(threadId) + '</div>' +
            '<form class="chat-composer" id="chat-form" autocomplete="off">' +
              '<input type="file" id="chat-file-input" accept="image/jpeg,image/png,image/webp" hidden>' +
              '<button type="button" class="chat-attach-btn" id="chat-attach-btn" data-act="chat-attach" aria-label="' + E(T('chat.attach.btnAria')) + '"' + (isBusy ? ' disabled' : '') + '>' + I('image', { size: 18 }) + '</button>' +
              '<textarea class="chat-input" id="chat-input" rows="1" maxlength="1500" placeholder="' + E(T('chat.inputPlaceholder')) + '" aria-label="' + E(T('chat.inputPlaceholder')) + '"></textarea>' +
              '<button type="submit" class="chat-send-btn' + (isBusy ? ' is-busy' : '') + '" id="chat-send" data-act="chat-send" aria-label="' + E(T('chat.sendAria')) + '"' + (isBusy ? ' disabled aria-busy="true"' : '') + '>' + I('send') + '</button>' +
            '</form>' +
          '</div>'
        : '<form class="chat-composer" id="chat-form" autocomplete="off">' +
            '<textarea class="chat-input" id="chat-input" rows="1" maxlength="1500" placeholder="' + E(T('chat.inputPlaceholder')) + '" aria-label="' + E(T('chat.inputPlaceholder')) + '"></textarea>' +
            '<button type="submit" class="chat-send-btn' + (isBusy ? ' is-busy' : '') + '" id="chat-send" data-act="chat-send" aria-label="' + E(T('chat.sendAria')) + '"' + (isBusy ? ' disabled aria-busy="true"' : '') + '>' + I('send') + '</button>' +
          '</form>';

      const dropOverlayHtml = isBarrett
        ? '<div class="chat-drop-overlay" id="chat-drop-overlay" aria-hidden="true">' + I('image', { size: 22 }) + '<span>' + E(T('chat.attach.dropHint')) + '</span></div>'
        : '';

      const mentorProfile = LM.getMentorProfile ? LM.getMentorProfile(threadId) : null;
      const profileOpenable = Boolean(mentorProfile && mentorProfile.profileEnabled);
      const headIdentityHtml = profileOpenable
        ? '<button type="button" class="chat-head-profile-trigger" id="chat-head-profile-btn" data-act="mentor-profile" data-mentor-id="' + E(threadId) + '" aria-label="' + E(T('chat.profile.openAria', { name: mentorProfile.displayName })) + '">' +
            avatarMarkup(meta, 'sm') +
            '<span class="chat-head-info">' +
              '<span class="chat-head-name-row"><span class="chat-head-name">' + E(title) + '</span>' + (th && th.archived ? '<span class="chat-arch-tag">' + E(T('chat.archive.badge')) + '</span>' : '') + '</span>' +
              '<span class="chat-head-role">' + E(isBusy ? T('chat.typingLabel') : T(meta.roleKey)) + '</span>' +
            '</span>' +
          '</button>'
        : avatarMarkup(meta, 'sm') +
          '<div class="chat-head-info">' +
            '<div class="chat-head-name-row"><div class="chat-head-name">' + E(title) + '</div>' + (th && th.archived ? '<span class="chat-arch-tag">' + E(T('chat.archive.badge')) + '</span>' : '') + '</div>' +
            '<div class="chat-head-role">' + E(isBusy ? T('chat.typingLabel') : T(meta.roleKey)) + '</div>' +
          '</div>';

      return '<section class="chat-thread chat-theme-' + E(meta.accent) + '" data-thread-id="' + E(threadId) + '">' +
        dropOverlayHtml +
        '<header class="chat-head">' +
          '<a class="backbtn chat-back" href="#/chat" aria-label="' + E(T('common.back')) + '">' + I('back') + '</a>' +
          headIdentityHtml +
          '<div class="chat-head-acts">' +
            restoreHeadBtn +
            '<button type="button" class="iconbtn chat-head-btn' + (searchOpen ? ' active' : '') + '" id="chat-search-toggle" data-act="chat-search-toggle" aria-expanded="' + searchOpen + '" aria-label="' + E(T('chat.searchToggleAria')) + '">' + I('search', { size: 16 }) + '</button>' +
            '<button type="button" class="iconbtn chat-head-btn" data-act="thread-menu" data-thread-id="' + E(threadId) + '" aria-label="' + E(T('chat.threadMenuAria')) + '">' + I('dots', { size: 16 }) + '</button>' +
          '</div>' +
        '</header>' +
        searchBarHtml +
        pinBarHtml +
        stageNotice +
        '<div class="chat-feed" id="chat-feed" role="log" aria-live="polite">' + feedHtml(threadId) + '</div>' +
        composerHtml +
      '</section>';
    },

    scrollToBottom() {
      const feed = document.getElementById('chat-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    },

    scrollToMessage(msgId) {
      const feed = document.getElementById('chat-feed');
      if (!feed || !msgId || !feed.querySelectorAll) return false;
      const nodes = feed.querySelectorAll('[data-msg-id]');
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].dataset && nodes[i].dataset.msgId === msgId) {
          if (typeof nodes[i].scrollIntoView === 'function') {
            try { nodes[i].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            catch (e) { nodes[i].scrollIntoView(); }
          }
          return true;
        }
      }
      return false;
    },

    scrollAfterPaint(threadId) {
      let targetId = st.focusMsgId;
      if (!targetId && threadId && st.search.open && st.search.threadId === threadId && String(st.search.q || '').trim()) {
        const matches = getThreadSearchMatches(threadId, LM.ChatStore.getMessages(threadId));
        if (matches.length) {
          const idx = Math.max(0, Math.min(st.search.activeIdx || 0, matches.length - 1));
          targetId = matches[idx];
        }
      }
      if (targetId && this.scrollToMessage(targetId)) return;
      this.scrollToBottom();
    },

    renderMentorProfile(mentorId) {
      const profile = LM.getMentorProfile ? LM.getMentorProfile(mentorId) : null;
      return renderMentorProfileHtml(profile);
    },

    isMentorProfileOpen() {
      return Boolean(document.getElementById('mentor-profile-overlay'));
    },

    openMentorProfile(mentorId, opts) {
      opts = opts || {};
      const profile = LM.getMentorProfile ? LM.getMentorProfile(mentorId) : null;
      if (!profile || !profile.profileEnabled) return false;
      const mount = document.getElementById('app') || document.body;
      if (!mount || typeof document.createElement !== 'function') return false;

      const feed = document.getElementById('chat-feed');
      const existing = document.getElementById('mentor-profile-overlay');
      if (!existing) {
        st.profileOverlay.savedFeedScrollTop = feed ? feed.scrollTop : null;
      }
      st.profileOverlay.mentorId = mentorId;
      st.profileOverlay.closingHistory = false;

      const overlay = existing || document.createElement('div');
      overlay.id = 'mentor-profile-overlay';
      overlay.className = 'mentor-profile-overlay';
      overlay.dataset.mentorId = mentorId;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', profile.displayName);
      overlay.innerHTML = renderMentorProfileHtml(profile);
      overlay.scrollTop = 0;

      if (!existing) {
        mount.appendChild(overlay);
      }

      if (
        opts.pushHistory !== false &&
        typeof window !== 'undefined' &&
        window.history &&
        typeof window.history.pushState === 'function'
      ) {
        const curState = window.history.state;
        if (!curState || curState.ascendOverlay !== 'mentor-profile' || curState.mentorId !== mentorId) {
          try {
            window.history.pushState({ ascendOverlay: 'mentor-profile', mentorId: mentorId }, '');
            st.profileOverlay.pushedHistory = true;
          } catch (e) {}
        }
      }

      const backBtn = document.getElementById('mentor-profile-back');
      if (backBtn && typeof backBtn.focus === 'function') {
        try { backBtn.focus({ preventScroll: true }); } catch (e) { backBtn.focus(); }
      }
      return true;
    },

    closeMentorProfile(opts) {
      opts = opts || {};
      const overlay = document.getElementById('mentor-profile-overlay');
      const wasOpen = Boolean(overlay);
      if (overlay && typeof overlay.remove === 'function') {
        overlay.remove();
      }
      const savedTop = st.profileOverlay.savedFeedScrollTop;
      const feed = document.getElementById('chat-feed');
      if (feed && savedTop != null) {
        feed.scrollTop = savedTop;
      }

      const shouldPopHistory =
        wasOpen &&
        !opts.fromPopstate &&
        !opts.skipHistory &&
        st.profileOverlay.pushedHistory &&
        typeof window !== 'undefined' &&
        window.history &&
        window.history.state &&
        window.history.state.ascendOverlay === 'mentor-profile' &&
        typeof window.history.back === 'function';

      st.profileOverlay.mentorId = null;
      st.profileOverlay.savedFeedScrollTop = null;
      st.profileOverlay.pushedHistory = false;

      if (shouldPopHistory) {
        st.profileOverlay.closingHistory = true;
        try {
          window.history.back();
        } catch (e) {
          st.profileOverlay.closingHistory = false;
        }
      } else {
        st.profileOverlay.closingHistory = false;
      }

      return wasOpen;
    },

    prefillComposer(prompt) {
      const text = String(prompt || '').trim();
      const inp = document.getElementById('chat-input');
      if (!inp || !text) return false;
      inp.value = text;
      if (inp.style) {
        inp.style.height = 'auto';
        if (inp.scrollHeight) {
          inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
        }
      }
      if (typeof inp.focus === 'function') inp.focus();
      if (typeof inp.setSelectionRange === 'function') {
        try { inp.setSelectionRange(text.length, text.length); } catch (e) {}
      }
      return true;
    }
  };
})();
