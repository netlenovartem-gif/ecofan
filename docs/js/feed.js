initPage();

function formatMoscow(dateStr) {
  const utc = new Date(dateStr.replace(' ', 'T') + 'Z');
  return utc.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function canDelete(userId) {
  return userId === myId() || isAdmin();
}

async function loadPosts() {
  const posts = await api('/api/posts');
  document.getElementById('posts').innerHTML = posts.map(p => `
    <div class="post">
      <div class="post-head">
        <strong>${p.name}</strong>
        <span>${formatMoscow(p.created_at)}</span>
      </div>
      <p>${p.text}</p>
      <div class="post-actions">
        <button class="btn-like" data-id="${p.id}">❤️ ${p.likes}</button>
        <button class="btn-comment" data-id="${p.id}">💬 ${p.comments}</button>
        ${canDelete(p.user_id) ? `<button class="btn-delete-post" data-id="${p.id}">🗑 Удалить</button>` : ''}
      </div>
      <div class="comments" id="comments-${p.id}"></div>
      <form class="comment-form" data-id="${p.id}">
        <input type="text" name="text" placeholder="Комментарий..." required>
        <button type="submit" class="btn btn-primary">Отправить</button>
      </form>
    </div>
  `).join('');

  document.querySelectorAll('.btn-like').forEach(btn => {
    btn.onclick = async () => {
      await api(`/api/posts/${btn.dataset.id}/like`, { method: 'POST' });
      loadPosts();
    };
  });

  document.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить пост?')) return;
      await api(`/api/posts/${btn.dataset.id}`, { method: 'DELETE' });
      loadPosts();
    };
  });

  document.querySelectorAll('.btn-comment').forEach(btn => {
    btn.onclick = async () => {
      const box = document.getElementById(`comments-${btn.dataset.id}`);
      const comments = await api(`/api/posts/${btn.dataset.id}/comments`);

      if (box.innerHTML.trim()) {
            box.innerHTML = '';
            return;
      }

      box.innerHTML = comments.map(c => `
        <div class="comment">
          <strong>${c.name}</strong>: ${c.text}
          ${canDelete(c.user_id) ? `<button class="btn-delete-comment" data-id="${c.id}">🗑</button>` : ''}
        </div>
      `).join('') || '<div class="comment">Пока нет комментариев</div>';

      document.querySelectorAll('.btn-delete-comment').forEach(b => {
        b.onclick = async () => {
          if (!confirm('Удалить комментарий?')) return;
          await api(`/api/comments/${b.dataset.id}`, { method: 'DELETE' });
          loadPosts();
        };
      });
    };
  });

  document.querySelectorAll('.comment-form').forEach(form => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = new FormData(form).get('text');
      await api(`/api/posts/${form.dataset.id}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      form.reset();
      loadPosts();
    };
  });
}

document.getElementById('post-form').onsubmit = async (e) => {
  e.preventDefault();
  const text = new FormData(e.target).get('text');
  await api('/api/posts', { method: 'POST', body: JSON.stringify({ text }) });
  e.target.reset();
  loadPosts();
};

loadPosts();