/**
 * ============================================================
 *  Osservatorio679 Transparency Widget — o679-widget.js
 *  Versione: 1.0.0
 *  Licenza: CC BY — Osservatorio679
 *  GDPR Reference: Art. 12 §7 — Trasparenza Dinamica
 * ============================================================
 *
 *  UTILIZZO BASE:
 *
 *    <script src="https://feniva.github.io/o679/widget/o679-widget.js"></script>
 *    <script>
 *      const o679 = new Osservatorio679Widget({
 *        titolare:   "Azienda SRL",
 *        privacyUrl: "https://www.azienda.it/privacy",
 *        dpoEmail:   "dpo@azienda.it"
 *      });
 *
 *      // All'avvio di un trattamento:
 *      o679.notify({ event: 'login', dataLevel: 'normal', icon: 'dati-personali' });
 *    </script>
 */

(function(global) {
  'use strict';

  // ===================================================================
  //  CONFIGURAZIONE
  // ===================================================================
  const DEFAULTS = {
    titolare:    'Titolare del trattamento',
    privacyUrl:  '#',
    dpoEmail:    '',
    position:    'bottom-right',     // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    lang:        'it',
    autoHide:    12000,              // ms — 0 per non nascondere automaticamente
    iconBaseUrl: 'https://feniva.github.io/o679/icons/',
    storageKey:  'o679_consent_log',
    debug:       false,
  };

  const LABELS = {
    it: {
      normal:        'Trattamento dati in corso',
      sensitive:     '⚠ Dati particolari in trattamento',
      profiling:     '🔴 Profilazione in corso',
      btn_info:      'ℹ Informativa',
      btn_pause:     '⏸ Sospendi',
      btn_revoke:    '✕ Revoca consenso',
      btn_ok:        '✓ OK',
      badge_normal:  'Dati personali',
      badge_sensitive: 'Dati sensibili (Art. 9)',
      badge_profiling: 'Dati profilizzanti (Art. 22)',
      info_title:    'Dettaglio trattamento',
      gdpr_note:     'I tuoi dati vengono trattati nel rispetto del GDPR.',
    },
    en: {
      normal:        'Data processing in progress',
      sensitive:     '⚠ Special category data processing',
      profiling:     '🔴 Profiling in progress',
      btn_info:      'ℹ Info',
      btn_pause:     '⏸ Pause',
      btn_revoke:    '✕ Revoke consent',
      btn_ok:        '✓ OK',
      badge_normal:  'Personal data',
      badge_sensitive: 'Sensitive data (Art. 9)',
      badge_profiling: 'Profiling data (Art. 22)',
      info_title:    'Processing details',
      gdpr_note:     'Your data is processed in accordance with GDPR.',
    },
  };

  const COLORS = {
    normal:    { primary: '#00897B', bg: '#E0F2F1', border: '#00897B', text: '#004D40' },
    sensitive: { primary: '#F9A825', bg: '#FFF8E1', border: '#F9A825', text: '#E65100' },
    profiling: { primary: '#C62828', bg: '#FFEBEE', border: '#C62828', text: '#B71C1C' },
  };

  // Icon CSS filters to colorize B&W icons
  const ICON_FILTERS = {
    normal:    'brightness(0) saturate(100%) invert(41%) sepia(99%) saturate(400%) hue-rotate(130deg)',
    sensitive: 'brightness(0) saturate(100%) invert(70%) sepia(100%) saturate(500%) hue-rotate(-20deg)',
    profiling: 'brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(500%) hue-rotate(-20deg)',
  };

  // ===================================================================
  //  CLASSE PRINCIPALE
  // ===================================================================
  class Osservatorio679Widget {

    constructor(options = {}) {
      this.cfg = Object.assign({}, DEFAULTS, options);
      this.L   = LABELS[this.cfg.lang] || LABELS.it;
      this._currentEvent  = null;
      this._hideTimer     = null;
      this._consentLog    = this._loadConsentLog();
      this._paused        = {};
      this._bubbleEl      = null;
      this._modalEl       = null;
      this._injectStyles();
      if (this.cfg.debug) console.log('[O679] Widget initialized', this.cfg);
    }

    // -------------------------------------------------------------------
    //  API PUBBLICA
    // -------------------------------------------------------------------

    /**
     * Notifica all'utente un trattamento in corso.
     *
     * @param {Object}  opts
     * @param {string}  opts.event      ID evento univoco (es. 'form-submit', 'analytics')
     * @param {string}  opts.dataLevel  'normal' | 'sensitive' | 'profiling'
     * @param {string}  opts.icon       ID icona Osservatorio679 (es. 'trattamento-in-corso')
     * @param {string}  opts.message    Testo descrittivo del trattamento
     * @param {boolean} opts.canRevoke  Se true mostra pulsante "Revoca consenso"
     * @param {string}  opts.purpose    Finalità del trattamento (per popup info)
     * @param {Function} opts.onPause   Callback chiamato quando l'utente sospende
     * @param {Function} opts.onRevoke  Callback chiamato quando l'utente revoca
     * @returns {Promise<string>}       'ok' | 'paused' | 'revoked'
     */
    notify(opts = {}) {
      return new Promise((resolve) => {
        const ev = {
          event:      opts.event     || 'generic',
          dataLevel:  opts.dataLevel || 'normal',
          icon:       opts.icon      || 'trattamento-in-corso',
          message:    opts.message   || this.L.normal,
          canRevoke:  opts.canRevoke !== false,
          purpose:    opts.purpose   || '',
          onPause:    opts.onPause   || null,
          onRevoke:   opts.onRevoke  || null,
          resolve,
        };

        // Se questo evento è stato già sospeso dall'utente, blocca
        if (this._paused[ev.event]) {
          if (this.cfg.debug) console.log(`[O679] Event "${ev.event}" is paused — skipping`);
          resolve('paused');
          return;
        }

        this._currentEvent = ev;
        this._showBubble(ev);
        this._logEvent(ev, 'shown');
      });
    }

    /**
     * Mostra il widget persistente (es. per notifica costante)
     */
    show(opts = {}) {
      this.notify({ ...opts, canRevoke: false });
    }

    /**
     * Nasconde il widget
     */
    hide() {
      if (this._bubbleEl) {
        this._bubbleEl.style.opacity = '0';
        this._bubbleEl.style.transform = 'translateY(20px) scale(0.95)';
        setTimeout(() => {
          if (this._bubbleEl) this._bubbleEl.style.display = 'none';
        }, 300);
      }
    }

    /**
     * Sblocca un evento precedentemente sospeso
     */
    resume(eventId) {
      delete this._paused[eventId];
      if (this.cfg.debug) console.log(`[O679] Event "${eventId}" resumed`);
    }

    /**
     * Restituisce il log dei consensi/sospensioni dell'utente
     */
    getConsentLog() {
      return this._consentLog;
    }

    /**
     * Cancella il log dei consensi
     */
    clearConsentLog() {
      this._consentLog = [];
      try { localStorage.removeItem(this.cfg.storageKey); } catch(e) {}
    }

    // -------------------------------------------------------------------
    //  UI: BUBBLE
    // -------------------------------------------------------------------
    _showBubble(ev) {
      if (!this._bubbleEl) this._bubbleEl = this._createBubble();
      clearTimeout(this._hideTimer);

      const colors = COLORS[ev.dataLevel] || COLORS.normal;
      const title  = this.L[ev.dataLevel] || this.L.normal;
      const badge  = this.L['badge_' + ev.dataLevel] || this.L.badge_normal;
      const iconUrl = this.cfg.iconBaseUrl + ev.dataLevel + '/' + ev.icon + '.png';

      this._bubbleEl.querySelector('.o679-border').style.background   = colors.primary;
      this._bubbleEl.querySelector('.o679-bubble-inner').style.borderColor = colors.border + '40';
      this._bubbleEl.querySelector('.o679-bubble-inner').style.background  = colors.bg;
      this._bubbleEl.querySelector('.o679-title').textContent   = title;
      this._bubbleEl.querySelector('.o679-message').textContent = ev.message;
      this._bubbleEl.querySelector('.o679-badge').textContent   = badge;
      this._bubbleEl.querySelector('.o679-badge').style.background = colors.primary + '20';
      this._bubbleEl.querySelector('.o679-badge').style.color       = colors.text;
      this._bubbleEl.querySelector('.o679-badge').style.borderColor = colors.border;

      const iconEl = this._bubbleEl.querySelector('.o679-icon');
      iconEl.style.filter = ICON_FILTERS[ev.dataLevel] || '';
      iconEl.onerror = () => { iconEl.style.display = 'none'; };
      iconEl.src = iconUrl;

      const revokeBtn = this._bubbleEl.querySelector('.o679-btn-revoke');
      revokeBtn.style.display = ev.canRevoke ? 'inline-flex' : 'none';

      this._bubbleEl.style.display = 'block';
      requestAnimationFrame(() => {
        this._bubbleEl.style.opacity   = '1';
        this._bubbleEl.style.transform = 'translateY(0) scale(1)';
      });

      if (this.cfg.autoHide > 0) {
        this._hideTimer = setTimeout(() => this.hide(), this.cfg.autoHide);
      }
    }

    _createBubble() {
      const pos = this._positionStyles(this.cfg.position);
      const el = document.createElement('div');
      el.id = 'o679-widget';
      el.style.cssText = `
        position: fixed; ${pos};
        z-index: 999999;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: opacity .3s ease, transform .3s ease;
        display: none;
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 300px;
        min-width: 240px;
      `;
      el.innerHTML = `
        <div class="o679-border" style="width:4px;position:absolute;left:0;top:0;bottom:0;border-radius:12px 0 0 12px;"></div>
        <div class="o679-bubble-inner" style="
          background:#fff; border:1.5px solid #ccc; border-radius:12px;
          padding:14px 16px 12px 18px; box-shadow:0 6px 30px rgba(0,0,0,.18);
          position:relative;
        ">
          <button class="o679-close" style="position:absolute;top:8px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:#999;line-height:1;" title="Chiudi">×</button>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <img class="o679-icon" src="" alt="icona trattamento" width="28" height="28" style="flex-shrink:0;">
            <div>
              <div class="o679-title" style="font-size:12px;font-weight:700;color:#212121;line-height:1.3;"></div>
              <div class="o679-badge" style="display:inline-block;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;border:1px solid;margin-top:3px;"></div>
            </div>
          </div>
          <div class="o679-message" style="font-size:11px;color:#616161;line-height:1.5;margin-bottom:10px;"></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="o679-btn-info" style="flex:1;min-width:60px;padding:5px 8px;border-radius:6px;border:1.5px solid #00897B;background:#E0F2F1;color:#004D40;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">${this.L.btn_info}</button>
            <button class="o679-btn-pause" style="flex:1;min-width:60px;padding:5px 8px;border-radius:6px;border:1.5px solid #F9A825;background:#FFF8E1;color:#E65100;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">${this.L.btn_pause}</button>
            <button class="o679-btn-revoke" style="flex:1;min-width:70px;padding:5px 8px;border-radius:6px;border:1.5px solid #C62828;background:#FFEBEE;color:#C62828;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">${this.L.btn_revoke}</button>
          </div>
          <div style="text-align:center;margin-top:8px;">
            <a href="${this.cfg.privacyUrl}" target="_blank" style="font-size:9px;color:#9E9E9E;text-decoration:none;">Informativa completa — Osservatorio679</a>
          </div>
        </div>
      `;

      // Event listeners
      el.querySelector('.o679-close').addEventListener('click', () => {
        this.hide();
        if (this._currentEvent) {
          this._currentEvent.resolve('ok');
          this._logEvent(this._currentEvent, 'dismissed');
        }
      });

      el.querySelector('.o679-btn-info').addEventListener('click', () => {
        this._showModal();
      });

      el.querySelector('.o679-btn-pause').addEventListener('click', () => {
        const ev = this._currentEvent;
        if (!ev) return;
        this._paused[ev.event] = true;
        this._logEvent(ev, 'paused');
        if (ev.onPause) ev.onPause(ev.event);
        ev.resolve('paused');
        this.hide();
        this._showPausedNotice(ev);
      });

      el.querySelector('.o679-btn-revoke').addEventListener('click', () => {
        const ev = this._currentEvent;
        if (!ev) return;
        this._logEvent(ev, 'revoked');
        if (ev.onRevoke) ev.onRevoke(ev.event);
        ev.resolve('revoked');
        this.hide();
        this._showRevokeConfirm(ev);
      });

      document.body.appendChild(el);
      return el;
    }

    // -------------------------------------------------------------------
    //  UI: MODAL INFO
    // -------------------------------------------------------------------
    _showModal() {
      if (!this._modalEl) this._modalEl = this._createModal();
      const ev = this._currentEvent;
      if (!ev) return;

      const colors = COLORS[ev.dataLevel] || COLORS.normal;
      this._modalEl.querySelector('.o679-modal-title').textContent    = this.L.info_title;
      this._modalEl.querySelector('.o679-modal-titolare').textContent = this.cfg.titolare;
      this._modalEl.querySelector('.o679-modal-message').textContent  = ev.message;
      this._modalEl.querySelector('.o679-modal-purpose').textContent  = ev.purpose || '—';
      this._modalEl.querySelector('.o679-modal-level').textContent    = this.L['badge_' + ev.dataLevel] || ev.dataLevel;
      this._modalEl.querySelector('.o679-modal-level').style.color    = colors.text;
      this._modalEl.querySelector('.o679-modal-level').style.background = colors.bg;
      this._modalEl.querySelector('.o679-modal-header').style.background = colors.primary;

      const dpoLine = this._modalEl.querySelector('.o679-modal-dpo');
      dpoLine.innerHTML = this.cfg.dpoEmail
        ? `DPO/RPD: <a href="mailto:${this.cfg.dpoEmail}" style="color:#00897B;">${this.cfg.dpoEmail}</a>`
        : '';

      this._modalEl.style.display = 'flex';
    }

    _createModal() {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999999;
        display:none;align-items:center;justify-content:center;
        font-family:'Segoe UI',Arial,sans-serif;
      `;
      el.innerHTML = `
        <div style="background:white;border-radius:14px;max-width:440px;width:90%;overflow:hidden;box-shadow:0 10px 50px rgba(0,0,0,.3);">
          <div class="o679-modal-header" style="background:#00897B;color:white;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div class="o679-modal-title" style="font-size:15px;font-weight:700;"></div>
              <div style="font-size:10px;opacity:.8;margin-top:2px;">Osservatorio679 — GDPR Art. 12</div>
            </div>
            <button class="o679-modal-close" style="background:rgba(255,255,255,.2);border:none;color:white;font-size:18px;cursor:pointer;border-radius:6px;padding:2px 8px;font-family:inherit;">×</button>
          </div>
          <div style="padding:20px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <tr>
                <td style="padding:6px 0;font-weight:700;color:#616161;width:40%;vertical-align:top;">Titolare:</td>
                <td class="o679-modal-titolare" style="padding:6px 0;color:#212121;font-weight:600;"></td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:700;color:#616161;vertical-align:top;">Trattamento:</td>
                <td class="o679-modal-message" style="padding:6px 0;color:#212121;line-height:1.5;"></td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:700;color:#616161;vertical-align:top;">Finalità:</td>
                <td class="o679-modal-purpose" style="padding:6px 0;color:#212121;"></td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-weight:700;color:#616161;vertical-align:top;">Tipo dato:</td>
                <td><span class="o679-modal-level" style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;"></span></td>
              </tr>
            </table>
            <div class="o679-modal-dpo" style="margin-top:10px;font-size:11px;color:#616161;"></div>
            <div style="margin-top:12px;padding:10px;background:#F5F5F5;border-radius:8px;font-size:10px;color:#9E9E9E;line-height:1.5;">
              ${this.L.gdpr_note}
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
              <a href="${this.cfg.privacyUrl}" target="_blank" style="display:inline-flex;align-items:center;padding:8px 16px;background:#E0F2F1;color:#004D40;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">Leggi informativa completa</a>
              <button class="o679-modal-close-btn" style="padding:8px 16px;background:#00897B;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Chiudi</button>
            </div>
          </div>
        </div>
      `;
      el.querySelector('.o679-modal-close').addEventListener('click', () => { el.style.display = 'none'; });
      el.querySelector('.o679-modal-close-btn').addEventListener('click', () => { el.style.display = 'none'; });
      el.addEventListener('click', (e) => { if (e.target === el) el.style.display = 'none'; });
      document.body.appendChild(el);
      return el;
    }

    // -------------------------------------------------------------------
    //  NOTICE DI CONFERMA
    // -------------------------------------------------------------------
    _showPausedNotice(ev) {
      const notice = document.createElement('div');
      notice.style.cssText = `
        position:fixed;bottom:20px;right:20px;z-index:999998;
        background:#FFF8E1;border:1.5px solid #F9A825;border-radius:10px;
        padding:12px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#E65100;
        box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:280px;
      `;
      notice.innerHTML = `
        <strong>⏸ Trattamento sospeso</strong><br>
        Il trattamento <em>${ev.event}</em> è stato sospeso per questa sessione.<br>
        <a href="${this.cfg.privacyUrl}" target="_blank" style="color:#00897B;font-size:11px;">Gestisci le preferenze →</a>
      `;
      document.body.appendChild(notice);
      setTimeout(() => notice.remove(), 6000);
    }

    _showRevokeConfirm(ev) {
      const notice = document.createElement('div');
      notice.style.cssText = `
        position:fixed;bottom:20px;right:20px;z-index:999998;
        background:#FFEBEE;border:1.5px solid #C62828;border-radius:10px;
        padding:12px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#C62828;
        box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:280px;
      `;
      notice.innerHTML = `
        <strong>✕ Consenso revocato</strong><br>
        La tua richiesta di revoca del consenso è stata registrata e verrà gestita dal titolare nel rispetto dell'Art. 17 GDPR.<br>
        <a href="mailto:${this.cfg.dpoEmail || ''}" style="color:#C62828;font-size:11px;">Contatta il DPO →</a>
      `;
      document.body.appendChild(notice);
      setTimeout(() => notice.remove(), 8000);
    }

    // -------------------------------------------------------------------
    //  LOGGING & STORAGE
    // -------------------------------------------------------------------
    _logEvent(ev, action) {
      const entry = {
        ts:        new Date().toISOString(),
        event:     ev.event,
        dataLevel: ev.dataLevel,
        action,
      };
      this._consentLog.push(entry);
      try {
        localStorage.setItem(this.cfg.storageKey, JSON.stringify(this._consentLog.slice(-50)));
      } catch(e) {}
      if (this.cfg.debug) console.log('[O679] Log entry', entry);
    }

    _loadConsentLog() {
      try {
        return JSON.parse(localStorage.getItem(this.cfg.storageKey) || '[]');
      } catch(e) { return []; }
    }

    // -------------------------------------------------------------------
    //  UTILITIES
    // -------------------------------------------------------------------
    _positionStyles(pos) {
      const map = {
        'bottom-right': 'bottom:20px;right:20px',
        'bottom-left':  'bottom:20px;left:20px',
        'top-right':    'top:20px;right:20px',
        'top-left':     'top:20px;left:20px',
      };
      return map[pos] || map['bottom-right'];
    }

    _injectStyles() {
      if (document.getElementById('o679-styles')) return;
      const style = document.createElement('style');
      style.id = 'o679-styles';
      style.textContent = `
        #o679-widget * { box-sizing: border-box; }
        #o679-widget button:hover { opacity: 0.85; }
        #o679-widget a:hover { text-decoration: underline; }
      `;
      document.head.appendChild(style);
    }
  }

  // ===================================================================
  //  UTILITY STATICA: getIconUrl
  // ===================================================================
  Osservatorio679Widget.getIconUrl = function(iconId, state, baseUrl) {
    baseUrl = baseUrl || DEFAULTS.iconBaseUrl;
    state   = state   || 'normal';
    return baseUrl + state + '/' + iconId + '.png';
  };

  // Esponi globalmente
  global.Osservatorio679Widget = Osservatorio679Widget;

})(typeof window !== 'undefined' ? window : global);
