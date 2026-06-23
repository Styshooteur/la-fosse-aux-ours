import { FORMATS, FORMAT_LABELS, STATUS_LABELS, ELIM_SIZES, PARTICIPANT_COLORS } from './types.js';
import { generateId, formatDate, nowIso } from './utils.js';
import {
  createTournament,
  validateMatchResult,
  previewEditImpact,
  declareForfeit,
  renameParticipant,
  generateNextSwissRound,
  duplicateTournament,
  swissCanAdvance,
  hasStarted,
  refreshDerivedState,
} from './engine.js';
import { computeStandings } from './standings.js';
import {
  fetchTournaments,
  fetchTournament,
  saveTournament as persistTournament,
  deleteTournament as removeTournament,
} from './api.js';
import {
  escapeHtml,
  renderMatchCard,
  renderStandingsTable,
  renderEliminationBracket,
  exportTournamentJson,
  exportBracketPng,
  renderSwissView,
} from './render.js';
import { renderDoubleEliminationView } from './render-double-elim.js?v=20260624d';

export function initTournamentsAdmin({ root, getPin, showStatus }) {
  let view = 'list';
  let tournaments = [];
  let current = null;
  let saveTimer = null;
  const editingMatchIds = new Set();

  root.innerHTML = `
    <div class="tournament-app" id="tournament-app">
      <div class="tournament-view tournament-view--list" id="t-view-list"></div>
      <div class="tournament-view tournament-view--create hidden" id="t-view-create"></div>
      <div class="tournament-view tournament-view--detail hidden" id="t-view-detail"></div>
    </div>`;

  const $list = root.querySelector('#t-view-list');
  const $create = root.querySelector('#t-view-create');
  const $detail = root.querySelector('#t-view-detail');

  renderList();

  function showView(name) {
    view = name;
    $list.classList.toggle('hidden', name !== 'list');
    $create.classList.toggle('hidden', name !== 'create');
    $detail.classList.toggle('hidden', name !== 'detail');
  }

  async function autoSave() {
    if (!current) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await persistTournament(current, getPin());
      } catch (err) {
        showStatus(err.message, true);
      }
    }, 1500);
  }

  async function loadList() {
    try {
      tournaments = await fetchTournaments();
    } catch (err) {
      tournaments = [];
      showStatus(err.message || 'Impossible de charger la liste des tournois.', true);
    }
    renderList();
  }

  function renderList() {
    const rows = tournaments.length
      ? tournaments
          .map(
            (t) => `
        <tr class="${t.broadcast ? 't-row--live' : ''}">
          <td>${escapeHtml(t.name)}</td>
          <td>${escapeHtml(FORMAT_LABELS[t.format] || t.format)}</td>
          <td>${escapeHtml(STATUS_LABELS[t.status] || t.status)}</td>
          <td>${t.participantCount}</td>
          <td>
            <label class="t-broadcast-toggle" title="Diffusion sur le site public">
              <input type="checkbox" data-action="broadcast" data-id="${t.id}" ${t.broadcast ? 'checked' : ''} aria-label="Diffusion publique" />
              <span class="t-broadcast-slider" aria-hidden="true"></span>
              <span class="t-broadcast-state ${t.broadcast ? 't-broadcast-state--on' : 't-broadcast-state--off'}">${t.broadcast ? 'En cours' : 'Inactif'}</span>
            </label>
          </td>
          <td>${formatDate(t.createdAt)}</td>
          <td class="t-actions">
            <button type="button" class="t-btn t-btn--primary" data-action="resume" data-id="${t.id}">Reprendre</button>
            <button type="button" class="t-btn t-btn--ghost" data-action="duplicate" data-id="${t.id}">Dupliquer</button>
            <button type="button" class="t-btn t-btn--danger" data-action="delete" data-id="${t.id}">Supprimer</button>
          </td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="t-empty">Aucun tournoi créé.</td></tr>';

    $list.innerHTML = `
      <div class="t-list-header">
        <h2>Tournois</h2>
        <button type="button" class="t-btn t-btn--primary" id="t-btn-new">+ Nouveau tournoi</button>
      </div>
      <table class="t-list-table">
        <thead>
          <tr><th>Nom</th><th>Format</th><th>Statut</th><th>Participants</th><th>Diffusion</th><th>Créé le</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    $list.querySelector('#t-btn-new').addEventListener('click', () => {
      renderCreateForm();
      showView('create');
    });

    $list.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'resume') {
          current = await fetchTournament(id);
          refreshDerivedState(current);
          renderDetail();
          showView('detail');
        } else if (action === 'duplicate') {
          const source = await fetchTournament(id);
          current = duplicateTournament(source);
          await persistTournament(current, getPin());
          showStatus('Tournoi dupliqué.');
          await loadList();
        } else if (action === 'delete') {
          if (!confirm('Supprimer ce tournoi ?')) return;
          await removeTournament(id, getPin());
          showStatus('Tournoi supprimé.');
          await loadList();
        }
      });
    });

    $list.querySelectorAll('input[data-action="broadcast"]').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const enabled = e.target.checked;
        try {
          const tournament = await fetchTournament(id);
          tournament.broadcast = enabled;
          tournament.updatedAt = nowIso();
          await persistTournament(tournament, getPin());
          if (current?.id === id) current.broadcast = enabled;
          const row = tournaments.find((x) => x.id === id);
          if (row) row.broadcast = enabled;
          showStatus(
            enabled ? 'Diffusion activée — visible sur le site public.' : 'Diffusion désactivée.'
          );
          renderList();
        } catch (err) {
          e.target.checked = !enabled;
          showStatus(err.message, true);
        }
      });
    });
  }

  function renderCreateForm() {
    const isElim = (f) => f === FORMATS.SINGLE_ELIMINATION || f === FORMATS.DOUBLE_ELIMINATION;

    $create.innerHTML = `
      <div class="t-form-header">
        <button type="button" class="t-btn t-btn--ghost" id="t-back-list">← Retour</button>
        <h2>Nouveau tournoi</h2>
      </div>
      <form class="t-form" id="t-create-form">
        <label class="t-field"><span>Nom du tournoi</span><input type="text" id="t-name" required placeholder="Ex. — Grand Tournoi de Vendeaume" /></label>
        <label class="t-field"><span>Format</span>
          <select id="t-format">
            ${Object.entries(FORMAT_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </label>
        <label class="t-field t-field--elim"><span>Nombre de participants</span>
          <select id="t-count">${ELIM_SIZES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
        </label>
        <label class="t-field t-field--free hidden"><span>Nombre de participants</span>
          <input type="number" id="t-count-free" min="2" max="64" value="4" />
        </label>
        <label class="t-field t-field--groups hidden"><span>Nombre de groupes</span>
          <input type="number" id="t-groups" min="2" max="8" value="2" />
        </label>
        <label class="t-field t-field--groups hidden"><span>Qualifiés par groupe</span>
          <input type="number" id="t-qualifiers" min="1" max="4" value="2" />
        </label>
        <label class="t-field t-field--swiss hidden"><span>Nombre de rondes</span>
          <input type="number" id="t-swiss-rounds" min="1" max="12" value="3" />
        </label>
        <label class="t-field t-field--seed"><span>Tirage au sort</span>
          <select id="t-seed"><option value="random">Aléatoire</option><option value="manual">Manuel (ordre saisi)</option></select>
        </label>
        <div id="t-participants-fields"></div>
        <button type="submit" class="t-btn t-btn--primary t-btn--large">Générer le bracket</button>
      </form>`;

    const formatEl = $create.querySelector('#t-format');
    const countEl = $create.querySelector('#t-count');
    const participantsWrap = $create.querySelector('#t-participants-fields');

    function updateFormatFields() {
      const f = formatEl.value;
      $create.querySelector('.t-field--elim').classList.toggle('hidden', !isElim(f));
      $create.querySelector('.t-field--free').classList.toggle('hidden', isElim(f));
      $create.querySelector('.t-field--groups').classList.toggle('hidden', f !== FORMATS.GROUP_STAGE);
      $create.querySelector('.t-field--swiss').classList.toggle('hidden', f !== FORMATS.SWISS);
      $create.querySelector('.t-field--seed').classList.toggle('hidden', f === FORMATS.ROUND_ROBIN || f === FORMATS.SWISS);
      renderParticipantFields();
    }

    function participantCount() {
      const f = formatEl.value;
      if (isElim(f)) return Number(countEl.value);
      return Number($create.querySelector('#t-count-free').value) || 4;
    }

    function renderParticipantFields() {
      const n = participantCount();
      participantsWrap.innerHTML = `
        <h3 class="t-subtitle">Participants (${n})</h3>
        ${Array.from({ length: n }, (_, i) => `
          <div class="t-participant-row">
            <label class="t-field t-field--grow"><span>Participant ${i + 1}</span>
              <input type="text" class="t-p-name" data-i="${i}" placeholder="Nom" required />
            </label>
            <label class="t-field t-field--color"><span>Couleur</span>
              <input type="color" class="t-p-color" data-i="${i}" value="${PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]}" />
            </label>
          </div>`).join('')}`;
    }

    formatEl.addEventListener('change', updateFormatFields);
    countEl.addEventListener('change', renderParticipantFields);
    $create.querySelector('#t-count-free')?.addEventListener('input', renderParticipantFields);
    $create.querySelector('#t-back-list').addEventListener('click', () => showView('list'));
    updateFormatFields();

    $create.querySelector('#t-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const format = formatEl.value;
        const n = participantCount();
        const participants = Array.from({ length: n }, (_, i) => ({
          id: generateId('p'),
          name: participantsWrap.querySelector(`.t-p-name[data-i="${i}"]`).value.trim(),
          color: participantsWrap.querySelector(`.t-p-color[data-i="${i}"]`).value,
          logo: null,
          forfeited: false,
        }));

        current = createTournament({
          name: $create.querySelector('#t-name').value,
          format,
          participantCount: n,
          participants,
          seedMode: $create.querySelector('#t-seed').value,
          groupCount: Number($create.querySelector('#t-groups')?.value || 2),
          qualifiersPerGroup: Number($create.querySelector('#t-qualifiers')?.value || 2),
          swissRounds: Number($create.querySelector('#t-swiss-rounds')?.value || 3),
        });

        await persistTournament(current, getPin());
        showStatus('Tournoi créé.');
        await loadList();
        renderDetail();
        showView('detail');
      } catch (err) {
        showStatus(err.message, true);
      }
    });
  }

  function renderDetail() {
    if (!current) return;
    refreshDerivedState(current);
    const t = current;

    const cardOpts = { editingMatchIds };

    let body = '';
    if (t.format === FORMATS.SINGLE_ELIMINATION) {
      body = renderEliminationBracket(t, null, cardOpts);
    } else if (t.format === FORMATS.DOUBLE_ELIMINATION) {
      body = renderDoubleEliminationView(t, cardOpts);
    } else if (t.format === FORMATS.ROUND_ROBIN) {
      body = `
        <div class="t-match-list">${t.state.matches.map((m) => renderMatchCard(t, m, { ...cardOpts, editing: editingMatchIds.has(m.id) })).join('')}</div>
        <h3 class="t-subtitle">Classement</h3>
        ${renderStandingsTable(t.state.standings)}`;
    } else if (t.format === FORMATS.GROUP_STAGE) {
      const groupsHtml = (t.state.groups || [])
        .map((g) => {
          const groupMatches = t.state.matches.filter((m) => m.groupId === g.id);
          const standings = computeStandings(t, { groupId: g.id });
          return `
            <section class="t-group">
              <h3 class="t-subtitle">${escapeHtml(g.name)}</h3>
              <div class="t-match-list">${groupMatches.map((m) => renderMatchCard(t, m, { ...cardOpts, editing: editingMatchIds.has(m.id) })).join('')}</div>
              ${renderStandingsTable(standings)}
            </section>`;
        })
        .join('');
      const knockout = t.state.phase === 'knockout'
        ? `<h3 class="t-subtitle">Phase éliminatoire</h3>${renderEliminationBracket(t, null, { knockoutOnly: true, ...cardOpts })}`
        : '';
      body = groupsHtml + knockout;
    } else if (t.format === FORMATS.SWISS) {
      body = renderSwissView(t, { canAdvance: swissCanAdvance(t), ...cardOpts });
    }

    const participantsHtml = t.participants
      .filter((p) => !p.isBye)
      .map(
        (p) => `
      <div class="t-participant-manage">
        <span class="t-color-dot" style="background:${p.color}"></span>
        <input type="text" class="t-rename-input" data-pid="${p.id}" value="${escapeHtml(p.name)}" />
        ${p.forfeited ? '<span class="t-forfeit-badge">Forfait</span>' : hasStarted(t) ? `<button type="button" class="t-btn t-btn--ghost t-forfeit" data-pid="${p.id}">Forfait</button>` : ''}
      </div>`
      )
      .join('');

    $detail.innerHTML = `
      <div class="t-detail-header">
        <button type="button" class="t-btn t-btn--ghost" id="t-back-list2">← Liste</button>
        <div>
          <h2>${escapeHtml(t.name)}</h2>
          <p class="t-meta">${escapeHtml(FORMAT_LABELS[t.format])} · ${escapeHtml(STATUS_LABELS[t.status])} · ${t.participants.length} participants</p>
        </div>
        <div class="t-detail-actions">
          <button type="button" class="t-btn t-btn--ghost" id="t-export-json">Export JSON</button>
          <button type="button" class="t-btn t-btn--ghost" id="t-export-png">Export image</button>
        </div>
      </div>
      <aside class="t-sidebar">
        <h3>Participants</h3>
        ${participantsHtml}
      </aside>
      <div class="tournament-view-body">${body}</div>`;

    $detail.querySelector('#t-back-list2').addEventListener('click', async () => {
      await loadList();
      showView('list');
    });

    $detail.querySelector('#t-export-json').addEventListener('click', () => exportTournamentJson(t));
    $detail.querySelector('#t-export-png').addEventListener('click', async () => {
      try {
        await exportBracketPng($detail);
        showStatus('Image exportée.');
      } catch {
        showStatus('Export image impossible sur ce navigateur.', true);
      }
    });

    $detail.querySelectorAll('.t-btn-validate').forEach((btn) => {
      btn.addEventListener('click', () => handleMatchValidate(btn.dataset.matchId));
    });

    $detail.querySelectorAll('.t-btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingMatchIds.add(btn.dataset.matchId);
        renderDetail();
      });
    });

    $detail.querySelectorAll('.t-btn-cancel-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingMatchIds.delete(btn.dataset.matchId);
        renderDetail();
      });
    });

    $detail.querySelectorAll('.t-rename-input').forEach((input) => {
      input.addEventListener('change', async () => {
        renameParticipant(current, input.dataset.pid, input.value);
        await persistTournament(current, getPin());
        renderDetail();
        showStatus('Participant renommé.');
      });
    });

    $detail.querySelectorAll('.t-forfeit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Déclarer un forfait pour ce participant ?')) return;
        declareForfeit(current, btn.dataset.pid);
        await persistTournament(current, getPin());
        renderDetail();
        showStatus('Forfait enregistré.');
      });
    });

    const swissBtn = $detail.querySelector('#t-swiss-next');
    if (swissBtn) {
      swissBtn.addEventListener('click', async () => {
        try {
          generateNextSwissRound(current);
          await persistTournament(current, getPin());
          renderDetail();
          showStatus('Nouvelle ronde générée.');
        } catch (err) {
          showStatus(err.message, true);
        }
      });
    }
  }

  async function handleMatchValidate(matchId) {
    const card = $detail.querySelector(`.t-match[data-match-id="${matchId}"]`);
    if (!card) return;

    const inputA = card.querySelector('.t-score-input[data-side="A"]');
    const inputB = card.querySelector('.t-score-input[data-side="B"]');
    if (!inputA || !inputB) {
      showStatus('Ouvrez l\'édition du match pour modifier les scores.', true);
      return;
    }

    const scoreA = Number(inputA.value);
    const scoreB = Number(inputB.value);

    try {
      const impact = previewEditImpact(current, matchId, scoreA, scoreB);
      const warnings = [];
      if (impact.resetCount > 0) {
        warnings.push(`${impact.resetCount} match(s) terminé(s) en aval seront réinitialisés`);
      }
      if (impact.removesSwissRounds > 0) {
        warnings.push(`${impact.removesSwissRounds} match(s) des rondes suivantes (système suisse) seront supprimés`);
      }
      if (impact.removesKnockout) {
        warnings.push('la phase éliminatoire sera réinitialisée');
      }
      if (warnings.length) {
        const ok = confirm(
          `Modifier ce résultat entraînera un recalcul en cascade :\n\n· ${warnings.join('\n· ')}\n\nContinuer ?`
        );
        if (!ok) return;
      }

      validateMatchResult(current, matchId, scoreA, scoreB);
      editingMatchIds.delete(matchId);
      await persistTournament(current, getPin());
      renderDetail();
      showStatus('Résultat enregistré.');
    } catch (err) {
      showStatus(err.message, true);
    }
  }

  return {
    async open() {
      showView('list');
      await loadList();
    },
  };
}
