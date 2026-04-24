/* Admin panel SPA — vanilla JS, no framework.
   Routes (via hash):
     #pages            list
     #pages/:slug      editor
     #pages/new        editor for new page
     #media            media library
     #nav              nav editor
*/
(function(){
'use strict';

// ── Globals ────────────────────────────────────────────────────────────────
let BLOCK_TYPES = [];      // loaded from /api/admin/block-types
let ACTIVE_EDITORS = [];   // CKEditor instances to destroy on view change
let CURRENT_PAGE = null;   // { slug, title, requires_auth, is_listed, blocks }

const main = document.getElementById('admin-main');

// ── Utilities ──────────────────────────────────────────────────────────────
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class')        el.className = v;
      else if (k === 'html')    el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function')
                                el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true)      el.setAttribute(k, '');
      else if (v === false || v == null) {}
      else                      el.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 3000);
}

async function api(path, opts) {
  const r = await fetch(path, Object.assign({
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  }, opts || {}));
  if (r.status === 401) { window.location.href = '/login.html'; return null; }
  const j = await r.json().catch(() => ({ ok:false, error:'Ungültige Antwort' }));
  if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

function destroyEditors() {
  ACTIVE_EDITORS.forEach(e => { try { e.destroy(); } catch(_){} });
  ACTIVE_EDITORS = [];
}

// ── Router ─────────────────────────────────────────────────────────────────
async function route() {
  destroyEditors();
  const hash = (location.hash || '#pages').slice(1);
  const [view, ...rest] = hash.split('/');
  try {
    if (view === 'pages' && rest.length === 0)            await viewPages();
    else if (view === 'pages' && rest[0] === 'new')       await viewEditor(null);
    else if (view === 'pages' && rest[0])                 await viewEditor(rest[0]);
    else if (view === 'media')                            await viewMedia();
    else if (view === 'nav')                              await viewNav();
    else                                                  await viewPages();
  } catch (err) {
    main.innerHTML = '';
    main.appendChild(h('div', { class:'error-box' }, 'Fehler: ' + err.message));
  }
}
window.addEventListener('hashchange', route);

// ── Bootstrapping ──────────────────────────────────────────────────────────
(async function init() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method:'POST' });
    window.location.href = '/';
  });
  try {
    const bt = await api('/api/admin/block-types');
    BLOCK_TYPES = bt.types;
  } catch (err) {
    main.innerHTML = 'Keine Admin-Rechte oder nicht eingeloggt. <a href="/login.html">Anmelden</a>';
    return;
  }
  route();
})();

// ── View: Pages list ───────────────────────────────────────────────────────
async function viewPages() {
  main.innerHTML = '';
  const { pages } = await api('/api/admin/pages');

  main.appendChild(h('div', { class:'toolbar' },
    h('h1', {}, 'Seiten'),
    h('a', { class:'btn primary', href:'#pages/new' }, '+ Neue Seite')
  ));

  const list = h('div', { class:'pages-list' });
  for (const p of pages) {
    const dt = p.has_draft ? new Date(p.draft_updated_at) : new Date(p.published_at);
    list.appendChild(h('div', { class:'page-card' },
      h('div', {},
        h('h3', {},
          p.has_draft && p.draft_title ? p.draft_title : p.title,
          p.has_draft ? h('span', { class:'badge draft' }, 'Entwurf') : null
        ),
        h('div', { class:'meta' },
          `/${p.slug === 'home' ? '' : p.slug}`,
          p.requires_auth ? ' · 🔒 geschützt' : '',
          p.is_listed ? '' : ' · versteckt',
          ` · ${p.has_draft ? 'zuletzt editiert' : 'veröffentlicht'}: ${dt.toLocaleString('de-DE')}`
        )
      ),
      h('div', { class:'page-card-actions' },
        h('a', { class:'btn', href:`/${p.slug === 'home' ? '' : p.slug}`, target:'_blank' }, 'Live ansehen'),
        p.has_draft ? h('a', { class:'btn', href:`/admin/preview/${p.slug}`, target:'_blank' }, 'Entwurf ansehen') : null,
        h('button', { class:'btn', onclick: () => duplicatePage(p.slug, p.title) }, 'Duplizieren'),
        h('a', { class:'btn primary', href:`#pages/${p.slug}` }, 'Bearbeiten')
      )
    ));
  }
  main.appendChild(list);
}

// ── View: Page editor ──────────────────────────────────────────────────────
async function viewEditor(slug) {
  main.innerHTML = '<div id="loading">Lade…</div>';

  if (slug) {
    const { page } = await api(`/api/admin/pages/${slug}`);
    // When there is a draft we edit the draft, otherwise the live copy.
    CURRENT_PAGE = {
      slug:          page.slug,
      title:         page.has_draft && page.draft_title ? page.draft_title : page.title,
      requires_auth: page.requires_auth,
      is_listed:     page.is_listed,
      blocks:        page.has_draft ? page.draft_blocks : page.blocks,
      // Metadata (read-only helpers for the UI)
      has_draft:     page.has_draft,
      live_title:    page.title,
      published_at:  page.published_at,
      draft_updated_at: page.draft_updated_at,
    };
  } else {
    CURRENT_PAGE = {
      slug:'', title:'', requires_auth:0, is_listed:1, blocks:[],
      has_draft:false, live_title:'', published_at:null, draft_updated_at:null,
    };
  }

  renderEditorBody(slug);
}

// Re-render the editor UI from the current CURRENT_PAGE state without
// re-fetching from the server. Used by the mode switcher and anywhere
// else that mutates CURRENT_PAGE.blocks in place.
function renderEditorBody(slug) {
  // Capture latest form values before rebuilding DOM, so meta edits
  // aren't lost when the user toggles modes.
  const titleEl = document.getElementById('page-title');
  const slugEl  = document.getElementById('page-slug');
  const authEl  = document.getElementById('page-requires-auth');
  const listEl  = document.getElementById('page-is-listed');
  if (titleEl) CURRENT_PAGE.title = titleEl.value;
  if (slugEl)  CURRENT_PAGE.slug  = slugEl.value;
  if (authEl)  CURRENT_PAGE.requires_auth = authEl.checked;
  if (listEl)  CURRENT_PAGE.is_listed     = listEl.checked;

  destroyEditors();
  main.innerHTML = '';

  // Toolbar
  main.appendChild(h('div', { class:'toolbar' },
    h('a', { class:'btn', href:'#pages' }, '← Zurück'),
    h('h1', {}, slug ? `Seite bearbeiten: ${CURRENT_PAGE.title}` : 'Neue Seite'),
    slug ? h('button', { class:'btn', onclick: () => viewRevisions(slug) }, '🕘 Versionen') : null
  ));

  // Status bar
  if (slug) main.appendChild(renderStatusBar());

  // Meta form
  const metaBox = h('div', { class:'editor-meta' },
    h('label', {},
      'Titel',
      h('input', { type:'text', id:'page-title', value: CURRENT_PAGE.title || '' })
    ),
    h('label', {},
      'Slug (URL-Pfad)',
      h('input', {
        type:'text', id:'page-slug', value: CURRENT_PAGE.slug || '',
        placeholder:'z.B. ueber-uns', readonly: slug ? true : false,
      })
    ),
    h('div', { class:'row' },
      h('label', {},
        h('input', {
          type:'checkbox', id:'page-requires-auth',
          checked: CURRENT_PAGE.requires_auth ? true : false,
        }),
        'Nur für angemeldete Mitglieder'
      ),
      h('label', {},
        h('input', {
          type:'checkbox', id:'page-is-listed',
          checked: CURRENT_PAGE.is_listed ? true : false,
        }),
        'In Navigation aufgelistet'
      )
    )
  );
  main.appendChild(metaBox);

  // Blocks container
  const blocksEl = h('div', { class:'blocks', id:'blocks' });

  // Mode helpers: a page is in "full HTML" mode when its only block is page_html.
  function isHtmlMode() {
    return CURRENT_PAGE.blocks.length === 1
        && CURRENT_PAGE.blocks[0] && CURRENT_PAGE.blocks[0].type === 'page_html';
  }
  function switchToHtmlMode() {
    if (isHtmlMode()) return;
    if (CURRENT_PAGE.blocks.length > 0) {
      if (!confirm('Beim Wechsel in den HTML-Modus werden alle vorhandenen Blöcke ENTFERNT. Weiter?')) return;
    }
    const titleVal = (document.getElementById('page-title') || {}).value || CURRENT_PAGE.title || 'Neue Seite';
    CURRENT_PAGE.blocks = [{
      type: 'page_html',
      data: { html: `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleVal}</title>
</head>
<body>
<h1>${titleVal}</h1>
<p>Hier steht der Inhalt.</p>
</body>
</html>` }
    }];
    renderEditorBody(slug);
  }
  function switchToBlockMode() {
    if (!isHtmlMode()) return;
    if (CURRENT_PAGE.blocks[0].data.html && CURRENT_PAGE.blocks[0].data.html.trim()) {
      if (!confirm('Beim Wechsel in den Block-Modus wird der HTML-Inhalt VERWORFEN. Weiter?')) return;
    }
    CURRENT_PAGE.blocks = [];
    renderEditorBody(slug);
  }

  // Mode switcher bar
  const modeBar = h('div', { class:'mode-bar',
    style:'display:flex;gap:8px;align-items:center;margin:12px 0;padding:8px 12px;background:#f4f4f6;border-radius:6px;' },
    h('span', { style:'font-weight:600;' }, 'Modus:'),
    h('button', {
      class: 'btn' + (isHtmlMode() ? '' : ' primary'),
      onclick: switchToBlockMode,
    }, '🧱 Blöcke'),
    h('button', {
      class: 'btn' + (isHtmlMode() ? ' primary' : ''),
      onclick: switchToHtmlMode,
    }, '📄 Ganze Seite als HTML'),
    isHtmlMode()
      ? h('span', { style:'color:#856404;font-size:13px;' },
          '⚠️ Nav/Footer/Styles der Site werden in diesem Modus NICHT eingebunden — das HTML ist das komplette Dokument.')
      : null
  );
  main.appendChild(modeBar);
  main.appendChild(blocksEl);

  if (isHtmlMode()) {
    // Single big textarea for the whole document
    const warn = h('div', {
      style:'background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;border-radius:4px;margin-bottom:8px;font-size:13px;color:#856404;' },
      h('strong', {}, '⚠️ HTML-Modus: '),
      'Der Inhalt wird ungefiltert als komplettes HTML-Dokument ausgeliefert — inklusive ',
      h('code', {}, '<script>'),
      '. Nur eigenen Code oder Code aus vertrauenswürdigen Quellen einfügen.'
    );
    const ta = h('textarea', {
      style:'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;width:100%;min-height:60vh;white-space:pre;',
      spellcheck:'false',
      oninput: e => { CURRENT_PAGE.blocks[0].data.html = e.target.value; }
    });
    ta.value = CURRENT_PAGE.blocks[0].data.html || '';
    blocksEl.appendChild(warn);
    blocksEl.appendChild(ta);

    // Action bar only (no block-add, no sortable)
    main.appendChild(renderActionBar(slug));
  } else {
    CURRENT_PAGE.blocks.forEach((b, i) => blocksEl.appendChild(renderBlockEditor(b, i)));

    // Add block bar
    main.appendChild(renderAddBlockBar());

    // Sticky action bar
    main.appendChild(renderActionBar(slug));

    // Make blocks sortable
    Sortable.create(blocksEl, {
      handle: '.block-head',
      animation: 150,
      onEnd: syncBlockOrder,
    });

    // Mount CKEditor instances
    mountCKEditors();
  }
}

function renderStatusBar() {
  const p = CURRENT_PAGE;
  if (!p.has_draft) {
    const d = p.published_at ? new Date(p.published_at).toLocaleString('de-DE') : '—';
    return h('div', { class:'status-bar status-live' },
      h('span', {}, '✅ Live — veröffentlicht am ' + d),
      h('span', { class:'hint' }, 'Änderungen werden als Entwurf gespeichert und gehen erst durch „Veröffentlichen" live.')
    );
  }
  const d = p.draft_updated_at ? new Date(p.draft_updated_at).toLocaleString('de-DE') : '—';
  return h('div', { class:'status-bar status-draft' },
    h('span', {}, '📝 Entwurf vorhanden — zuletzt bearbeitet ' + d),
    h('span', { class:'hint' }, 'Die Live-Version ist davon unberührt, bis Du „Veröffentlichen" drückst.')
  );
}

function renderActionBar(slug) {
  const delBtn = slug && !['home','mitglieder'].includes(slug)
    ? h('button', { class:'btn danger', onclick: deletePage }, '🗑 Seite löschen')
    : null;

  const saveBtn = h('button', { class:'btn', onclick: savePage }, '💾 Entwurf speichern');

  const previewBtn = slug
    ? h('button', {
        class:'btn',
        onclick: async () => {
          // Save current state first so preview reflects unsaved edits
          const saved = await savePage({ silent: true });
          if (saved) window.open(`/admin/preview/${slug}`, '_blank');
        }
      }, '👁 Vorschau')
    : null;

  const discardBtn = slug && CURRENT_PAGE.has_draft
    ? h('button', {
        class:'btn',
        onclick: discardDraft,
      }, '↺ Entwurf verwerfen')
    : null;

  const publishBtn = slug
    ? h('button', { class:'btn primary', onclick: publishPage }, '🚀 Veröffentlichen')
    : null;

  return h('div', { class:'sticky-save' },
    delBtn,
    h('div', { style:'flex:1' }),
    discardBtn, previewBtn, saveBtn, publishBtn
  );
}

function renderAddBlockBar() {
  const bar = h('div', { class:'add-block-bar' },
    h('h3', {}, '+ Block hinzufügen')
  );
  const btns = h('div', { class:'block-type-buttons' });
  for (const bt of BLOCK_TYPES) {
    // page_html is a page-level mode, not a block — switch via mode bar instead.
    if (bt.type === 'page_html') continue;
    btns.appendChild(h('button', {
      class:'block-type-btn',
      onclick: () => addBlock(bt.type),
    },
      h('span', { class:'icon' }, bt.icon || '▣'),
      bt.label
    ));
  }
  bar.appendChild(btns);
  return bar;
}

function addBlock(type) {
  CURRENT_PAGE.blocks.push({ type, data: defaultDataFor(type) });
  const i = CURRENT_PAGE.blocks.length - 1;
  const blocksEl = document.getElementById('blocks');
  const el = renderBlockEditor(CURRENT_PAGE.blocks[i], i);
  blocksEl.appendChild(el);
  mountCKEditors(el);
  el.scrollIntoView({ behavior:'smooth', block:'center' });
}

function defaultDataFor(type) {
  switch(type) {
    case 'hero':     return { headline:'', subheadline:'', image_url:'', image_alt:'', cta_primary:{label:'',href:''}, cta_ghost:{label:'',href:''} };
    case 'richtext': return { html:'' };
    case 'image':    return { image_url:'', alt:'', caption:'', align:'center' };
    case 'gallery':  return { images: [] };
    case 'boats':    return { headline:'', subheadline:'', items: [] };
    case 'events':   return { headline:'Veranstaltungskalender', subheadline:'Alle Termine auf einen Blick.' };
    case 'cta':      return { headline:'', text:'', button:{label:'',href:''} };
    case 'banner':   return { label:'Ankündigung:', source:'captain', text:'' };
    case 'members_table': return {};
    default:         return {};
  }
}

function getBlockType(type) {
  return BLOCK_TYPES.find(b => b.type === type);
}

function renderBlockEditor(block, idx) {
  const bt = getBlockType(block.type);
  const label = bt ? bt.label : block.type;
  const icon  = bt ? bt.icon  : '▣';

  const body = h('div', { class:'block-body' });

  if (bt && bt.fields) {
    for (const f of bt.fields) {
      body.appendChild(renderField(block, f, idx));
    }
  }

  const head = h('div', { class:'block-head' },
    h('span', { class:'block-icon' }, icon),
    h('span', { class:'block-title' }, label),
    h('button', {
      class:'btn tiny', title:'Hoch',
      onclick:(e)=>{ e.stopPropagation(); moveBlock(idx,-1); },
    }, '↑'),
    h('button', {
      class:'btn tiny', title:'Runter',
      onclick:(e)=>{ e.stopPropagation(); moveBlock(idx,1); },
    }, '↓'),
    h('button', {
      class:'btn tiny danger', title:'Entfernen',
      onclick:(e)=>{ e.stopPropagation(); removeBlock(idx); },
    }, '✕')
  );

  const wrap = h('div', { class:'block', 'data-idx': idx }, head, body);
  return wrap;
}

function renderField(block, field, blockIdx) {
  const val = block.data[field.key];
  const fieldEl = h('div', { class:'field' }, h('label', {}, field.label));

  switch(field.type) {
    case 'text': {
      const inp = h('input', {
        type:'text', value: val || '',
        oninput: e => { block.data[field.key] = e.target.value; }
      });
      fieldEl.appendChild(inp);
      break;
    }
    case 'textarea': {
      const ta = h('textarea', {
        oninput: e => { block.data[field.key] = e.target.value; }
      });
      ta.value = val || '';
      fieldEl.appendChild(ta);
      break;
    }
    case 'select': {
      const sel = h('select', {
        onchange: e => { block.data[field.key] = e.target.value; }
      });
      (field.options || []).forEach(o => {
        const opt = h('option', { value:o }, o);
        if (val === o) opt.selected = true;
        sel.appendChild(opt);
      });
      fieldEl.appendChild(sel);
      break;
    }
    case 'wysiwyg': {
      const ta = h('textarea', { class:'wysiwyg', 'data-block-idx':blockIdx, 'data-field-key':field.key });
      ta.value = val || '';
      fieldEl.appendChild(ta);
      break;
    }
    // ⚠️ SECURITY: 'code' fields store HTML verbatim, including <script>.
    // See lib/sanitizer.js for how to lock this down.
    case 'code': {
      const warn = h('div', { class:'code-warning',
        style:'background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;border-radius:4px;margin-bottom:8px;font-size:13px;color:#856404;' },
        h('strong', {}, '⚠️ Achtung: '),
        'Der Inhalt wird ungefiltert ausgeliefert — inklusive ',
        h('code', {}, '<script>'),
        '. Nur eigenen Code oder Code aus vertrauenswürdigen Quellen einfügen. ',
        'XSS-Risiko bei Copy/Paste von fremden Seiten.'
      );
      const ta = h('textarea', {
        style:'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;min-height:240px;white-space:pre;',
        spellcheck:'false',
        oninput: e => { block.data[field.key] = e.target.value; }
      });
      ta.value = val || '';
      fieldEl.appendChild(warn);
      fieldEl.appendChild(ta);
      break;
    }
    case 'image': {
      fieldEl.appendChild(renderImagePicker(block, field.key));
      break;
    }
    case 'link': {
      const current = val || {};
      const lblInp = h('input', {
        type:'text', placeholder:'Beschriftung', value: current.label || '',
        oninput: e => { block.data[field.key] = Object.assign({}, block.data[field.key], { label: e.target.value }); }
      });
      const hrefInp = h('input', {
        type:'text', placeholder:'https://… oder #anker', value: current.href || '',
        oninput: e => { block.data[field.key] = Object.assign({}, block.data[field.key], { href: e.target.value }); }
      });
      fieldEl.appendChild(h('div', { class:'link-picker' }, lblInp, hrefInp));
      break;
    }
    case 'image_list': {
      fieldEl.appendChild(renderGalleryPicker(block, field.key));
      break;
    }
    case 'boat_items': {
      fieldEl.appendChild(renderBoatItems(block, field.key));
      break;
    }
    default:
      fieldEl.appendChild(h('em', {}, `Unbekannter Feldtyp: ${field.type}`));
  }
  return fieldEl;
}

function renderImagePicker(block, key) {
  const container = h('div', { class:'image-picker' });
  function refresh() {
    container.innerHTML = '';
    const url = block.data[key];
    if (url) {
      container.appendChild(h('img', { src: url, alt:'' }));
      container.appendChild(h('button', {
        class:'btn tiny',
        onclick: () => openMediaPicker(u => { block.data[key] = u; refresh(); })
      }, 'Ändern'));
      container.appendChild(h('button', {
        class:'btn tiny danger',
        onclick: () => { block.data[key] = ''; refresh(); }
      }, 'Entfernen'));
    } else {
      container.appendChild(h('span', { class:'picker-empty' }, 'Kein Bild ausgewählt.'));
      container.appendChild(h('button', {
        class:'btn tiny primary',
        onclick: () => openMediaPicker(u => { block.data[key] = u; refresh(); })
      }, 'Bild wählen'));
    }
  }
  refresh();
  return container;
}

function renderGalleryPicker(block, key) {
  const container = h('div', { class:'gallery-list' });
  function refresh() {
    container.innerHTML = '';
    const imgs = block.data[key] || [];
    imgs.forEach((img, i) => {
      const slot = h('div', { class:'slot' },
        h('img', { src: img.image_url, alt: img.alt || '' }),
        h('button', {
          class:'rem',
          onclick: (e) => { e.stopPropagation(); imgs.splice(i, 1); refresh(); }
        }, '✕')
      );
      container.appendChild(slot);
    });
    container.appendChild(h('div', {
      class:'slot add-slot',
      onclick: () => openMediaPicker(u => {
        imgs.push({ image_url: u, alt: '' });
        block.data[key] = imgs;
        refresh();
      })
    }, '+'));
  }
  refresh();
  return container;
}

function renderBoatItems(block, key) {
  const container = h('div', { class:'boat-items' });
  function refresh() {
    container.innerHTML = '';
    const items = block.data[key] || [];
    items.forEach((it, i) => {
      const itemEl = h('div', { class:'boat-item' },
        h('div', { class:'boat-item-head' },
          h('span', { class:'handle' }, '⋮⋮'),
          h('strong', {}, it.title || `Kachel ${i+1}`),
          h('button', { class:'btn tiny', onclick:()=>{ if(i>0){items.splice(i-1,0,items.splice(i,1)[0]); refresh();} } }, '↑'),
          h('button', { class:'btn tiny', onclick:()=>{ if(i<items.length-1){items.splice(i+1,0,items.splice(i,1)[0]); refresh();} } }, '↓'),
          h('button', { class:'btn tiny danger', onclick:()=>{ items.splice(i,1); refresh(); } }, '✕')
        ),
        h('div', { class:'field' }, h('label',{},'Bild'), renderItemImagePicker(it, 'image_url')),
        h('div', { class:'field' }, h('label',{},'Alt-Text'),
          h('input', { type:'text', value: it.image_alt || '', oninput:e=>it.image_alt=e.target.value })),
        h('div', { class:'field' }, h('label',{},'Titel'),
          h('input', { type:'text', value: it.title || '', oninput:e=>{it.title=e.target.value; itemEl.querySelector('.boat-item-head strong').textContent=e.target.value||`Kachel ${i+1}`;} })),
        h('div', { class:'field' }, h('label',{},'Beschreibung'),
          h('input', { type:'text', value: it.text || '', oninput:e=>it.text=e.target.value })),
        h('div', { class:'field' }, h('label',{},'Meta (komma-getrennt)'),
          h('input', {
            type:'text',
            value: (it.meta||[]).join(', '),
            oninput: e => it.meta = e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
          })
        ),
        h('div', { class:'field' }, h('label',{},'Button'),
          h('div', { class:'link-picker' },
            h('input', { type:'text', placeholder:'Label', value:(it.cta&&it.cta.label)||'', oninput:e=>{ it.cta=it.cta||{}; it.cta.label=e.target.value; } }),
            h('input', { type:'text', placeholder:'Href',  value:(it.cta&&it.cta.href)||'',  oninput:e=>{ it.cta=it.cta||{}; it.cta.href=e.target.value; } })
          )
        )
      );
      container.appendChild(itemEl);
    });
    container.appendChild(h('button', {
      class:'btn',
      onclick: () => {
        items.push({ image_url:'', image_alt:'', title:'', text:'', meta:[], cta:{label:'',href:''} });
        block.data[key] = items;
        refresh();
      }
    }, '+ Kachel hinzufügen'));
  }
  refresh();
  return container;
}

function renderItemImagePicker(item, key) {
  const container = h('div', { class:'image-picker' });
  function refresh() {
    container.innerHTML = '';
    if (item[key]) {
      container.appendChild(h('img', { src: item[key], alt:'' }));
      container.appendChild(h('button', { class:'btn tiny', onclick:()=>openMediaPicker(u=>{item[key]=u; refresh();}) }, 'Ändern'));
      container.appendChild(h('button', { class:'btn tiny danger', onclick:()=>{item[key]=''; refresh();} }, 'Entfernen'));
    } else {
      container.appendChild(h('span', { class:'picker-empty' }, 'Kein Bild.'));
      container.appendChild(h('button', { class:'btn tiny primary', onclick:()=>openMediaPicker(u=>{item[key]=u; refresh();}) }, 'Bild wählen'));
    }
  }
  refresh();
  return container;
}

// ── Block manipulation ─────────────────────────────────────────────────────
function moveBlock(idx, delta) {
  const to = idx + delta;
  if (to < 0 || to >= CURRENT_PAGE.blocks.length) return;
  const [b] = CURRENT_PAGE.blocks.splice(idx, 1);
  CURRENT_PAGE.blocks.splice(to, 0, b);
  destroyEditors();
  viewEditor(CURRENT_PAGE.slug || null);
}
function removeBlock(idx) {
  if (!confirm('Diesen Block wirklich entfernen?')) return;
  CURRENT_PAGE.blocks.splice(idx, 1);
  destroyEditors();
  viewEditor(CURRENT_PAGE.slug || null);
}
function syncBlockOrder() {
  // After drag-drop, rebuild blocks array from DOM order
  const order = Array.from(document.querySelectorAll('#blocks .block'))
    .map(el => parseInt(el.dataset.idx, 10));
  const newBlocks = order.map(i => CURRENT_PAGE.blocks[i]);
  CURRENT_PAGE.blocks = newBlocks;
  destroyEditors();
  viewEditor(CURRENT_PAGE.slug || null);
}

// ── CKEditor mounting ──────────────────────────────────────────────────────
function mountCKEditors(scopeEl) {
  const root = scopeEl || document;
  const textareas = root.querySelectorAll('textarea.wysiwyg');
  textareas.forEach(ta => {
    if (ta.dataset.mounted) return;
    ta.dataset.mounted = '1';
    const blockIdx = parseInt(ta.dataset.blockIdx, 10);
    const key = ta.dataset.fieldKey;
    ClassicEditor.create(ta, {
      toolbar: [
        'heading','|','bold','italic','underline','strikethrough','|',
        'fontColor','fontBackgroundColor','|',
        'link','bulletedList','numberedList','|',
        'alignment','indent','outdent','|',
        'insertTable','blockQuote','|',
        'undo','redo','|','removeFormat','sourceEditing'
      ],
    }).then(editor => {
      ACTIVE_EDITORS.push(editor);
      editor.model.document.on('change:data', () => {
        CURRENT_PAGE.blocks[blockIdx].data[key] = editor.getData();
      });
    }).catch(err => {
      console.error('CKEditor failed', err);
    });
  });
}

// ── Save / publish / discard / delete ──────────────────────────────────────
async function savePage(opts) {
  const silent = opts && opts.silent;
  const title = document.getElementById('page-title').value.trim();
  const slug  = document.getElementById('page-slug').value.trim();
  const requires_auth = document.getElementById('page-requires-auth').checked;
  const is_listed     = document.getElementById('page-is-listed').checked;

  if (!title) { toast('Titel fehlt.', true); return false; }
  if (!slug)  { toast('Slug fehlt.', true); return false; }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
    toast('Slug: nur kleine Buchstaben, Zahlen, Bindestriche.', true); return false;
  }

  try {
    await api(`/api/admin/pages/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ title, requires_auth, is_listed, blocks: CURRENT_PAGE.blocks }),
    });
    if (!silent) toast('Entwurf gespeichert.');
    if (location.hash !== `#pages/${slug}`) {
      // First save of a new page — jump to its edit URL so refresh works
      location.hash = `#pages/${slug}`;
      return true;
    }
    // Stay on page but refresh the draft/live banner
    CURRENT_PAGE.slug = slug;
    CURRENT_PAGE.title = title;
    CURRENT_PAGE.has_draft = true;
    CURRENT_PAGE.draft_updated_at = new Date().toISOString();
    const oldBar = main.querySelector('.status-bar');
    if (oldBar) oldBar.replaceWith(renderStatusBar());
    const oldActions = main.querySelector('.sticky-save');
    if (oldActions) oldActions.replaceWith(renderActionBar(slug));
    return true;
  } catch (err) {
    toast('Fehler: ' + err.message, true);
    return false;
  }
}

async function duplicatePage(srcSlug, srcTitle) {
  const suggested = srcSlug + '-kopie';
  const newSlug = prompt(
    `Seite "${srcTitle}" duplizieren.\n\nNeuer Slug (klein, nur a–z, 0–9, Bindestrich):`,
    suggested
  );
  if (!newSlug) return;
  const cleaned = newSlug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(cleaned)) {
    toast('Ungültiger Slug. Nur kleine Buchstaben, Ziffern und Bindestriche.', true);
    return;
  }
  try {
    const r = await api(`/api/admin/pages/${srcSlug}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ new_slug: cleaned }),
    });
    toast('Seite dupliziert.');
    location.hash = '#pages/' + r.slug;
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

async function publishPage() {
  if (!CURRENT_PAGE.slug) {
    // Need to save first
    const ok = await savePage({ silent: true });
    if (!ok) return;
  } else {
    // Save any pending edits as draft first
    const ok = await savePage({ silent: true });
    if (!ok) return;
  }
  if (!confirm('Den aktuellen Entwurf jetzt veröffentlichen? Die Live-Version wird ersetzt.')) return;
  try {
    await api(`/api/admin/pages/${CURRENT_PAGE.slug}/publish`, { method:'POST' });
    toast('Veröffentlicht. ✅');
    // Reload editor state from server to clear draft flags
    await viewEditor(CURRENT_PAGE.slug);
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

async function discardDraft() {
  if (!CURRENT_PAGE.slug || !CURRENT_PAGE.has_draft) return;
  if (!confirm('Entwurf verwerfen? Alle seit der letzten Veröffentlichung gemachten Änderungen gehen verloren.')) return;
  try {
    await api(`/api/admin/pages/${CURRENT_PAGE.slug}/discard-draft`, { method:'POST' });
    toast('Entwurf verworfen.');
    await viewEditor(CURRENT_PAGE.slug);
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

async function deletePage() {
  if (!CURRENT_PAGE.slug) return;
  if (!confirm(`Seite "${CURRENT_PAGE.title}" wirklich löschen?`)) return;
  try {
    await api(`/api/admin/pages/${CURRENT_PAGE.slug}`, { method:'DELETE' });
    toast('Gelöscht.');
    location.hash = '#pages';
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

// ── Revisions ──────────────────────────────────────────────────────────────
async function viewRevisions(slug) {
  main.innerHTML = '<div id="loading">Lade…</div>';
  const { revisions } = await api(`/api/admin/pages/${slug}/revisions`);
  main.innerHTML = '';
  main.appendChild(h('div', { class:'toolbar' },
    h('a', { class:'btn', href:`#pages/${slug}` }, '← Zurück zum Editor'),
    h('h1', {}, `Versionshistorie: ${slug}`)
  ));

  if (!revisions.length) {
    main.appendChild(h('p', {}, 'Noch keine gespeicherten Versionen. Eine Version wird jedes Mal angelegt, wenn Du veröffentlichst.'));
    return;
  }

  const list = h('div', { class:'revisions-list' });
  revisions.forEach(r => {
    list.appendChild(h('div', { class:'revision-row' },
      h('div', {},
        h('strong', {}, r.title),
        h('div', { class:'meta' },
          new Date(r.created_at).toLocaleString('de-DE'),
          r.created_by_name ? ` · von ${r.created_by_name}` : ''
        )
      ),
      h('div', { class:'revision-actions' },
        h('button', { class:'btn tiny', onclick: () => previewRevision(slug, r.id) }, '👁 Vorschau'),
        h('button', {
          class:'btn tiny primary',
          onclick: () => restoreRevision(slug, r.id, r.title)
        }, '↩ Als Entwurf wiederherstellen')
      )
    ));
  });
  main.appendChild(list);
}

async function previewRevision(slug, id) {
  try {
    const { revision } = await api(`/api/admin/pages/${slug}/revisions/${id}`);
    // Simple client-side preview: open a new window with a JSON-dump representation
    // This keeps us from adding a server route just for this. The real preview
    // comes after "Restore" which stages it as a draft.
    const win = window.open('', '_blank');
    if (!win) { toast('Popup blockiert.', true); return; }
    const safe = JSON.stringify(revision.blocks, null, 2)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    win.document.write(`<!doctype html><meta charset="utf-8">
<title>Version vom ${new Date(revision.created_at).toLocaleString('de-DE')}</title>
<style>body{font-family:system-ui;padding:1rem;max-width:900px;margin:0 auto}
pre{background:#f4f4f4;padding:1rem;border-radius:4px;overflow:auto;font-size:.85rem;line-height:1.4}</style>
<h1>Version vom ${new Date(revision.created_at).toLocaleString('de-DE')}</h1>
<p><strong>Titel:</strong> ${revision.title.replace(/</g,'&lt;')}</p>
<p>Um diese Version live zu sehen, bitte zuerst als Entwurf wiederherstellen, dann „Vorschau" nutzen.</p>
<h2>Block-Struktur (zur Information)</h2>
<pre>${safe}</pre>`);
    win.document.close();
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

async function restoreRevision(slug, id, title) {
  if (!confirm(`Diese Version "${title}" als Entwurf wiederherstellen? Ein evtl. vorhandener Entwurf wird überschrieben. Die Live-Version bleibt unberührt, bis Du "Veröffentlichen" drückst.`)) return;
  try {
    await api(`/api/admin/pages/${slug}/revisions/${id}/restore`, { method:'POST' });
    toast('Als Entwurf wiederhergestellt.');
    location.hash = `#pages/${slug}`;
  } catch (err) {
    toast('Fehler: ' + err.message, true);
  }
}

// ── Media library + picker ─────────────────────────────────────────────────
let MEDIA_PICKER_CB = null;

function openMediaPicker(cb) {
  MEDIA_PICKER_CB = cb;
  document.getElementById('media-modal').hidden = false;
  loadMediaGrid();
}
document.getElementById('media-close').addEventListener('click', closeMediaPicker);
function closeMediaPicker() {
  document.getElementById('media-modal').hidden = true;
  MEDIA_PICKER_CB = null;
}

document.getElementById('media-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  await uploadMedia(file);
  e.target.value = '';
  loadMediaGrid();
});

async function uploadMedia(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/api/admin/media', { method:'POST', body: fd, credentials:'same-origin' });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'Upload fehlgeschlagen.');
    toast('Hochgeladen.');
    return j.media;
  } catch (err) {
    toast('Upload-Fehler: ' + err.message, true);
    throw err;
  }
}

async function loadMediaGrid() {
  const grid = document.getElementById('media-grid');
  grid.innerHTML = 'Lade…';
  try {
    const { media } = await api('/api/admin/media');
    grid.innerHTML = '';
    if (!media.length) {
      grid.appendChild(h('p', {}, 'Noch keine Bilder hochgeladen.'));
      return;
    }
    media.forEach(m => {
      const item = h('div', { class:'media-item' },
        h('img', {
          src: m.url, alt: m.alt || m.orig_name,
          onclick: () => {
            if (MEDIA_PICKER_CB) {
              MEDIA_PICKER_CB(m.url);
              closeMediaPicker();
            }
          }
        }),
        h('button', {
          class:'del',
          title:'Löschen',
          onclick: async (e) => {
            e.stopPropagation();
            if (!confirm('Bild löschen?')) return;
            try { await api(`/api/admin/media/${m.id}`, { method:'DELETE' }); loadMediaGrid(); }
            catch(err) { toast('Löschen fehlgeschlagen: '+err.message, true); }
          }
        }, '✕')
      );
      grid.appendChild(item);
    });
  } catch(err) {
    grid.innerHTML = 'Fehler: ' + err.message;
  }
}

// ── View: Media library (standalone) ───────────────────────────────────────
async function viewMedia() {
  main.innerHTML = '';
  main.appendChild(h('div', { class:'toolbar' },
    h('h1', {}, 'Medien'),
    h('label', { class:'btn primary' }, '📤 Bild hochladen',
      h('input', {
        type:'file', accept:'image/*', style:'display:none',
        onchange: async (e) => {
          const f = e.target.files[0]; if (!f) return;
          await uploadMedia(f); viewMedia();
        }
      })
    )
  ));
  const { media } = await api('/api/admin/media');
  if (!media.length) {
    main.appendChild(h('p', {}, 'Noch keine Bilder hochgeladen.'));
    return;
  }
  const grid = h('div', { class:'media-grid-big' });
  media.forEach(m => {
    const kb = m.bytes ? Math.round(m.bytes / 1024) + ' KB' : '';
    const dim = m.width && m.height ? `${m.width}×${m.height}` : '';
    const altInput = h('input', {
      type:'text', placeholder:'Alt-Text (für Barrierefreiheit)',
      value: m.alt || '',
      onblur: async (e) => {
        if (e.target.value === (m.alt || '')) return;
        try {
          await api(`/api/admin/media/${m.id}`, {
            method:'PATCH',
            body: JSON.stringify({ alt: e.target.value })
          });
          m.alt = e.target.value;
          toast('Alt-Text gespeichert.');
        } catch(err) { toast('Fehler: '+err.message, true); }
      }
    });
    grid.appendChild(h('div', { class:'media-card' },
      h('div', { class:'media-thumb' },
        h('img', { src:m.url, alt:m.alt||m.orig_name, title:m.orig_name })
      ),
      h('div', { class:'media-info' },
        h('div', { class:'media-filename', title:m.orig_name }, m.orig_name),
        h('div', { class:'media-dim' }, [dim, kb].filter(Boolean).join(' · ')),
        altInput,
        h('div', { class:'media-actions' },
          h('button', { class:'btn tiny', onclick: () => { navigator.clipboard.writeText(m.url); toast('URL kopiert.'); } }, '📋 URL'),
          h('button', {
            class:'btn tiny danger',
            onclick: async () => {
              if (!confirm('Bild löschen?')) return;
              try { await api(`/api/admin/media/${m.id}`, { method:'DELETE' }); viewMedia(); }
              catch(err) { toast('Fehler: '+err.message, true); }
            }
          }, '✕ Löschen')
        )
      )
    ));
  });
  main.appendChild(grid);
}

// ── View: Nav editor ───────────────────────────────────────────────────────
async function viewNav() {
  main.innerHTML = '';
  main.appendChild(h('div', { class:'toolbar' }, h('h1', {}, 'Navigation & Branding')));

  const { settings } = await api('/api/admin/settings');
  const nav        = settings.nav        || [];
  const footerNav  = settings.footer_nav || [];
  const branding   = settings.branding   || {};

  // Branding form
  const brandBox = h('div', { class:'editor-meta' },
    h('h2', { style:'margin:0;font-size:1rem' }, 'Branding'),
    h('label', {}, 'Seitenname',
      h('input', { type:'text', id:'b-site-name', value: branding.site_name || '' })),
    h('label', {}, 'Logo-URL',
      h('input', { type:'text', id:'b-logo-url', value: branding.logo_url || '/logo.png' })),
    h('label', {}, 'Footer-Text',
      h('input', { type:'text', id:'b-footer-note', value: branding.footer_note || '' }))
  );
  main.appendChild(brandBox);

  // Header nav
  const navBox = h('div', { class:'editor-meta' },
    h('h2', { style:'margin:0;font-size:1rem' }, 'Hauptnavigation')
  );
  const navList = h('div', { class:'nav-items', id:'nav-list' });
  navBox.appendChild(navList);
  nav.forEach(n => navList.appendChild(renderNavItem(n)));
  navBox.appendChild(h('button', {
    class:'btn', onclick: () => navList.appendChild(renderNavItem({ label:'', href:'' }))
  }, '+ Eintrag hinzufügen'));
  main.appendChild(navBox);
  Sortable.create(navList, { handle:'.handle', animation:150 });

  // Footer nav
  const footBox = h('div', { class:'editor-meta' },
    h('h2', { style:'margin:0;font-size:1rem' }, 'Footer-Navigation')
  );
  const footList = h('div', { class:'nav-items', id:'foot-list' });
  footBox.appendChild(footList);
  footerNav.forEach(n => footList.appendChild(renderNavItem(n)));
  footBox.appendChild(h('button', {
    class:'btn', onclick: () => footList.appendChild(renderNavItem({ label:'', href:'' }))
  }, '+ Eintrag hinzufügen'));
  main.appendChild(footBox);
  Sortable.create(footList, { handle:'.handle', animation:150 });

  main.appendChild(h('div', { class:'sticky-save' },
    h('button', { class:'btn primary', onclick: saveNavSettings }, '💾 Speichern')
  ));
}

function renderNavItem(item) {
  const el = h('div', { class:'nav-item' },
    h('span', { class:'handle' }, '⋮⋮'),
    h('input', { type:'text', placeholder:'Beschriftung', value: item.label || '' }),
    h('input', { type:'text', placeholder:'/pfad oder https://…', value: item.href || '' }),
    h('button', { class:'btn tiny danger', onclick: e => e.target.closest('.nav-item').remove() }, '✕')
  );
  return el;
}

function collectNavList(id) {
  return Array.from(document.getElementById(id).querySelectorAll('.nav-item')).map(el => {
    const [lbl, hrf] = el.querySelectorAll('input');
    return { label: lbl.value.trim(), href: hrf.value.trim() };
  }).filter(n => n.label && n.href);
}

async function saveNavSettings() {
  const nav        = collectNavList('nav-list');
  const footer_nav = collectNavList('foot-list');
  const branding   = {
    site_name:   document.getElementById('b-site-name').value.trim(),
    logo_url:    document.getElementById('b-logo-url').value.trim(),
    footer_note: document.getElementById('b-footer-note').value.trim(),
  };
  try {
    await api('/api/admin/settings/nav',        { method:'PUT', body: JSON.stringify({ value: nav }) });
    await api('/api/admin/settings/footer_nav', { method:'PUT', body: JSON.stringify({ value: footer_nav }) });
    await api('/api/admin/settings/branding',   { method:'PUT', body: JSON.stringify({ value: branding }) });
    toast('Einstellungen gespeichert.');
  } catch(err) {
    toast('Fehler: ' + err.message, true);
  }
}

})();
