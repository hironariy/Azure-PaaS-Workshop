---
title: Azure PaaS Workshop 受講者ポータル
---

# Azure PaaS Workshop 受講者ポータル

<p class="wp-lead">このポータルは、Azure PaaS Workshop を <strong>Azure Cloud Shell (Bash)</strong> だけで進めるための受講者向け入口です。App Service、Static Web Apps、Cosmos DB/DocumentDB、Key Vault、Managed Identity、Application Insights / Azure Monitor を使う PaaS 構成を、事前準備から cleanup まで順番に確認します。</p>

<style>
  :root {
    --wp-brand: #0078d4;
    --wp-brand-dark: #005a9e;
    --wp-brand-darker: #004578;
    --wp-accent: #3ba0e6;
    --wp-page: #f4f7fb;
    --wp-surface: #ffffff;
    --wp-border: #e3e8ef;
    --wp-border-strong: #cdd5e0;
    --wp-text: #1b2430;
    --wp-muted: #5b6675;
    --wp-done: #107c10;
    --wp-pre: #8661c5;
    --wp-d0: #0078d4;
    --wp-d1: #0e8f8a;
    --wp-d2: #d83b01;
    --wp-radius: 14px;
    --wp-radius-sm: 9px;
    --wp-shadow: 0 1px 2px rgba(16, 24, 40, .06), 0 4px 12px rgba(16, 24, 40, .06);
    --wp-shadow-sm: 0 1px 2px rgba(16, 24, 40, .07);
  }

  .site-header,
  .site-footer {
    display: none !important;
  }

  .page-content {
    padding-top: 1.2rem;
  }

  .page-content > .wrapper {
    max-width: 1360px;
  }

  .wp-lead {
    margin: 1.1rem 0 0;
    padding: .9rem 1.1rem;
    border: 1px solid var(--wp-border);
    border-left: 4px solid var(--wp-brand);
    border-radius: var(--wp-radius-sm);
    background: linear-gradient(180deg, #f3f9ff, var(--wp-surface));
    color: var(--wp-muted);
    font-size: 1.02rem;
    line-height: 1.75;
  }

  .workshop-portal {
    display: grid;
    grid-template-columns: minmax(24rem, 34%) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
    margin-top: 1.5rem;
  }

  .workshop-toc {
    position: sticky;
    top: 1rem;
    max-height: 86vh;
    overflow: auto;
    padding: 1.1rem 1.1rem 1.25rem;
    border: 1px solid var(--wp-border);
    border-radius: var(--wp-radius);
    background: var(--wp-page);
    box-shadow: var(--wp-shadow);
  }

  .wp-toc-title {
    display: flex;
    align-items: center;
    gap: .55rem;
    margin: .2rem 0 .35rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--wp-text);
  }

  .wp-toc-title .wp-dot {
    width: .55rem;
    height: .55rem;
    border-radius: 50%;
    background: var(--wp-brand);
    box-shadow: 0 0 0 3px rgba(0, 120, 212, .15);
  }

  .wp-toc-sub {
    margin-top: 1.5rem;
  }

  .wp-toc-note {
    margin: 0 0 .9rem;
    font-size: .83rem;
    line-height: 1.6;
    color: var(--wp-muted);
  }

  .wp-progress {
    margin-bottom: 1rem;
    padding: .7rem .85rem .8rem;
    border: 1px solid var(--wp-border);
    border-radius: var(--wp-radius-sm);
    background: var(--wp-surface);
    box-shadow: var(--wp-shadow-sm);
  }

  .wp-progress__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: .5rem;
  }

  .wp-progress__label {
    font-size: .9rem;
    font-weight: 700;
    color: var(--wp-text);
  }

  .wp-progress__count {
    font-size: .85rem;
    color: var(--wp-muted);
  }

  .wp-progress__count strong {
    font-size: 1rem;
    color: var(--wp-brand-dark);
  }

  .wp-progress__bar {
    height: .5rem;
    margin: .55rem 0 .55rem;
    border-radius: 999px;
    background: #e6ebf2;
    overflow: hidden;
  }

  .wp-progress__fill {
    width: 0;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--wp-brand), var(--wp-accent));
    transition: width .35s ease;
  }

  .wp-progress__reset {
    appearance: none;
    padding: .25rem .6rem;
    border: 1px solid var(--wp-border-strong);
    border-radius: 7px;
    background: var(--wp-surface);
    color: var(--wp-muted);
    font-size: .78rem;
    cursor: pointer;
  }

  .wp-steps,
  .wp-refs {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wp-step,
  .wp-ref {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: .7rem;
    padding: .6rem .75rem;
    border: 1px solid var(--wp-border);
    border-radius: var(--wp-radius-sm);
    background: var(--wp-surface);
    box-shadow: var(--wp-shadow-sm);
    transition: border-color .15s, box-shadow .15s, transform .15s;
  }

  .wp-ref {
    grid-template-columns: 1fr auto;
    border-left: 3px solid var(--wp-border-strong);
  }

  .wp-step:hover,
  .wp-ref:hover {
    border-color: var(--wp-accent);
    box-shadow: var(--wp-shadow);
    transform: translateY(-1px);
  }

  .wp-step__num {
    display: grid;
    place-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--wp-brand), var(--wp-brand-darker));
    color: white;
    font-size: .9rem;
    font-weight: 700;
  }

  .wp-step__body,
  .wp-ref__body {
    min-width: 0;
  }

  .wp-step__link,
  .wp-ref__link {
    display: block;
    color: var(--wp-text);
    font-weight: 700;
    line-height: 1.35;
    text-decoration: none;
  }

  .wp-step__link:hover,
  .wp-ref__link:hover {
    color: var(--wp-brand-dark);
    text-decoration: underline;
  }

  .wp-badge,
  .wp-ref__use {
    display: inline-block;
    margin-bottom: .18rem;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .02em;
    color: var(--wp-muted);
  }

  .wp-badge--pre { color: var(--wp-pre); }
  .wp-badge--d0 { color: var(--wp-d0); }
  .wp-badge--d1 { color: var(--wp-d1); }
  .wp-badge--d2 { color: var(--wp-d2); }

  .wp-step.is-active,
  .wp-ref.is-active {
    border-color: var(--wp-brand);
    box-shadow: 0 0 0 3px rgba(0, 120, 212, .12), var(--wp-shadow);
  }

  .wp-step.is-done {
    background: linear-gradient(180deg, #f4fbf4, var(--wp-surface));
  }

  .wp-step.is-done .wp-step__num {
    background: var(--wp-done);
  }

  .wp-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .workshop-toc input[type="checkbox"] {
    appearance: none;
    position: relative;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    border: 2px solid var(--wp-border-strong);
    border-radius: 6px;
    background: var(--wp-surface);
    cursor: pointer;
  }

  .workshop-toc input[type="checkbox"]:checked {
    border-color: var(--wp-done);
    background: var(--wp-done);
  }

  .workshop-toc input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    left: .36rem;
    top: .12rem;
    width: .34rem;
    height: .68rem;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .workshop-content {
    min-height: 86vh;
    overflow: hidden;
    border: 1px solid var(--wp-border);
    border-radius: var(--wp-radius);
    background: var(--wp-surface);
    box-shadow: var(--wp-shadow);
  }

  .workshop-content iframe {
    display: block;
    width: 100%;
    height: 86vh;
    border: 0;
  }

  @media (max-width: 900px) {
    .workshop-portal {
      grid-template-columns: 1fr;
    }

    .workshop-toc {
      position: static;
      max-height: none;
    }

    .workshop-content iframe {
      height: 72vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .workshop-portal *,
    .workshop-toc * {
      transition: none !important;
      animation: none !important;
    }
  }
</style>

<div class="workshop-portal">
  <nav class="workshop-toc" aria-label="ワークショップ教材 TOC">
    <h2 class="wp-toc-title"><span class="wp-dot" aria-hidden="true"></span>ワークショップ進行 TOC</h2>
    <p class="wp-toc-note">上から順に進めます。右側のチェックは進捗確認用で、ブラウザに自動保存されます。</p>

    <div class="wp-progress">
      <div class="wp-progress__head">
        <span class="wp-progress__label">進捗</span>
        <span class="wp-progress__count"><strong data-progress-count>0</strong> / <span data-progress-total>9</span> 完了</span>
      </div>
      <div class="wp-progress__bar" role="progressbar" aria-label="ワークショップ進捗" aria-valuemin="0" aria-valuemax="9" aria-valuenow="0">
        <div class="wp-progress__fill" data-progress-fill></div>
      </div>
      <button type="button" class="wp-progress__reset" data-progress-reset>進捗をリセット</button>
    </div>

    <ol class="wp-steps">
      <li class="wp-step" data-page="learner/cloud-shell-quickstart.ja.html">
        <span class="wp-step__num" aria-hidden="true">1</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--pre">開始</span>
          <a class="wp-step__link" href="learner/cloud-shell-quickstart.ja.html" target="workshop-content-frame">受講者クイックスタート</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-quickstart" aria-label="受講者クイックスタート完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-0-prerequisites.ja.html">
        <span class="wp-step__num" aria-hidden="true">2</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d0">Day 0</span>
          <a class="wp-step__link" href="learner/day-0-prerequisites.ja.html" target="workshop-content-frame">事前準備</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day0-prereq" aria-label="Day 0 事前準備完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-0-entra-id.ja.html">
        <span class="wp-step__num" aria-hidden="true">3</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d0">Day 0</span>
          <a class="wp-step__link" href="learner/day-0-entra-id.ja.html" target="workshop-content-frame">Entra ID と認証設定</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day0-entra" aria-label="Day 0 Entra ID 完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-1-deploy-infrastructure.ja.html">
        <span class="wp-step__num" aria-hidden="true">4</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d1">Day 1</span>
          <a class="wp-step__link" href="learner/day-1-deploy-infrastructure.ja.html" target="workshop-content-frame">PaaS インフラをデプロイ</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day1-infra" aria-label="Day 1 インフラデプロイ完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-1-deploy-frontend.ja.html">
        <span class="wp-step__num" aria-hidden="true">5</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d1">Day 1</span>
          <a class="wp-step__link" href="learner/day-1-deploy-frontend.ja.html" target="workshop-content-frame">フロントエンドをデプロイ</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day1-frontend" aria-label="Day 1 フロントエンドデプロイ完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-1-validation.ja.html">
        <span class="wp-step__num" aria-hidden="true">6</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d1">Day 1</span>
          <a class="wp-step__link" href="learner/day-1-validation.ja.html" target="workshop-content-frame">アプリを検証</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day1-validation" aria-label="Day 1 検証完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-2-operations.ja.html">
        <span class="wp-step__num" aria-hidden="true">7</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d2">Day 2</span>
          <a class="wp-step__link" href="learner/day-2-operations.ja.html" target="workshop-content-frame">監視と運用</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day2-ops" aria-label="Day 2 監視と運用完了"></label>
      </li>
      <li class="wp-step" data-page="learner/day-2-reliability.ja.html">
        <span class="wp-step__num" aria-hidden="true">8</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--d2">Day 2</span>
          <a class="wp-step__link" href="learner/day-2-reliability.ja.html" target="workshop-content-frame">信頼性と復旧</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-day2-reliability" aria-label="Day 2 信頼性と復旧完了"></label>
      </li>
      <li class="wp-step" data-page="learner/cleanup.ja.html">
        <span class="wp-step__num" aria-hidden="true">9</span>
        <span class="wp-step__body">
          <span class="wp-badge wp-badge--pre">終了</span>
          <a class="wp-step__link" href="learner/cleanup.ja.html" target="workshop-content-frame">Cleanup</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="lp-cleanup" aria-label="Cleanup 完了"></label>
      </li>
    </ol>

    <h2 class="wp-toc-title wp-toc-sub"><span class="wp-dot" aria-hidden="true"></span>迷ったときの参照</h2>
    <p class="wp-toc-note">順番に関係なく、必要なときに開く参照ページです。</p>

    <ul class="wp-refs">
      <li class="wp-ref" data-page="learner/troubleshooting.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">症状別の切り分け</span>
          <a class="wp-ref__link" href="learner/troubleshooting.ja.html" target="workshop-content-frame">トラブルシューティング</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-troubleshooting" aria-label="トラブルシューティング確認済み"></label>
      </li>
      <li class="wp-ref" data-page="reference/quick-reference-card.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">変数とコマンド</span>
          <a class="wp-ref__link" href="reference/quick-reference-card.ja.html" target="workshop-content-frame">クイックリファレンス</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-quickref" aria-label="クイックリファレンス確認済み"></label>
      </li>
      <li class="wp-ref" data-page="bicep-guide.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">IaC の背景</span>
          <a class="wp-ref__link" href="bicep-guide.ja.html" target="workshop-content-frame">Bicep ガイド</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-bicep" aria-label="Bicep ガイド確認済み"></label>
      </li>
      <li class="wp-ref" data-page="monitoring-guide.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">監視の深掘り</span>
          <a class="wp-ref__link" href="monitoring-guide.ja.html" target="workshop-content-frame">監視ガイド</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-monitoring" aria-label="監視ガイド確認済み"></label>
      </li>
      <li class="wp-ref" data-page="disaster-recovery-guide.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">BCDR</span>
          <a class="wp-ref__link" href="disaster-recovery-guide.ja.html" target="workshop-content-frame">BCDR ガイド</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-bcdr" aria-label="BCDR ガイド確認済み"></label>
      </li>
      <li class="wp-ref" data-page="application-code-comparison-iaas-paas.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">任意: コード差分</span>
          <a class="wp-ref__link" href="application-code-comparison-iaas-paas.ja.html" target="workshop-content-frame">IaaS / PaaS アプリコード比較</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="ref-code-comparison" aria-label="アプリコード比較確認済み"></label>
      </li>
    </ul>

    <h2 class="wp-toc-title wp-toc-sub"><span class="wp-dot" aria-hidden="true"></span>Development / Instructor</h2>
    <p class="wp-toc-note">Cloud Shell 本線ではありません。必要な場合だけ参照します。</p>

    <ul class="wp-refs">
      <li class="wp-ref" data-page="development/local-development-setup.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">任意: ローカル開発</span>
          <a class="wp-ref__link" href="development/local-development-setup.ja.html" target="workshop-content-frame">ローカル開発セットアップ</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="dev-local" aria-label="ローカル開発確認済み"></label>
      </li>
      <li class="wp-ref" data-page="development/deployment-scripts-guide.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">任意: 既存スクリプト</span>
          <a class="wp-ref__link" href="development/deployment-scripts-guide.ja.html" target="workshop-content-frame">デプロイスクリプトガイド</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="dev-scripts" aria-label="デプロイスクリプトガイド確認済み"></label>
      </li>
      <li class="wp-ref" data-page="development/instructor-guide.ja.html">
        <span class="wp-ref__body">
          <span class="wp-ref__use">講師向け</span>
          <a class="wp-ref__link" href="development/instructor-guide.ja.html" target="workshop-content-frame">インストラクターガイド</a>
        </span>
        <label class="wp-check"><input type="checkbox" data-progress-id="dev-instructor" aria-label="インストラクターガイド確認済み"></label>
      </li>
    </ul>
  </nav>

  <section class="workshop-content" aria-label="選択した教材本文">
    <iframe
      name="workshop-content-frame"
      src="learner/cloud-shell-quickstart.ja.html"
      title="選択したワークショップ教材本文"></iframe>
  </section>
</div>

<script>
  (function () {
    'use strict';

    var STORAGE_KEY = 'azure-paas-workshop-portal-progress-v1';
    var memoryState = {};
    var portal = document.querySelector('.workshop-portal');
    if (!portal) {
      return;
    }

    var frame = portal.querySelector('iframe[name="workshop-content-frame"]');
    var checkboxes = Array.prototype.slice.call(portal.querySelectorAll('input[type="checkbox"][data-progress-id]'));
    var stepItems = Array.prototype.slice.call(portal.querySelectorAll('.wp-step'));
    var navItems = Array.prototype.slice.call(portal.querySelectorAll('[data-page]'));
    var countEl = portal.querySelector('[data-progress-count]');
    var totalEl = portal.querySelector('[data-progress-total]');
    var fillEl = portal.querySelector('[data-progress-fill]');
    var barEl = portal.querySelector('[role="progressbar"]');
    var resetBtn = portal.querySelector('[data-progress-reset]');

    function readState() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      } catch (err) {
        return memoryState;
      }
    }

    function writeState(state) {
      memoryState = state;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        /* storage unavailable: keep progress for this page session only */
      }
    }

    function updateProgress() {
      var done = 0;
      stepItems.forEach(function (li) {
        var box = li.querySelector('input[type="checkbox"]');
        var isDone = !!(box && box.checked);
        li.classList.toggle('is-done', isDone);
        if (isDone) {
          done += 1;
        }
      });

      var total = stepItems.length;
      var pct = total ? Math.round((done / total) * 100) : 0;
      if (countEl) countEl.textContent = done;
      if (totalEl) totalEl.textContent = total;
      if (fillEl) fillEl.style.width = pct + '%';
      if (barEl) {
        barEl.setAttribute('aria-valuemax', String(total));
        barEl.setAttribute('aria-valuenow', String(done));
      }
    }

    function setActive(page) {
      navItems.forEach(function (item) {
        item.classList.toggle('is-active', item.getAttribute('data-page') === page);
      });
    }

    function normalizePage(url) {
      try {
        var parsed = new URL(url, window.location.href);
        return parsed.pathname.split('/').slice(-2).join('/');
      } catch (err) {
        return url;
      }
    }

    function injectFrameEnhancements() {
      if (!frame || !frame.contentDocument) return;
      try {
        var doc = frame.contentDocument;
        if (doc.getElementById('wp-embedded-style')) return;

        var style = doc.createElement('style');
        style.id = 'wp-embedded-style';
        style.textContent = [
          'pre { background:#0f172a !important; color:#e5e7eb !important; border-radius:10px; padding:1rem; overflow:auto; }',
          'code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }',
          '.wp-copy-wrap { position: relative; }',
          '.wp-copy-btn { position:absolute; top:.45rem; right:.45rem; border:1px solid #475569; border-radius:7px; background:#1e293b; color:#f8fafc; font-size:.78rem; padding:.25rem .55rem; cursor:pointer; }',
          '.wp-copy-btn:hover { background:#334155; }'
        ].join('\n');
        doc.head.appendChild(style);

        Array.prototype.slice.call(doc.querySelectorAll('pre')).forEach(function (pre) {
          if (pre.parentElement && pre.parentElement.classList.contains('wp-copy-wrap')) return;
          var wrap = doc.createElement('div');
          wrap.className = 'wp-copy-wrap';
          pre.parentNode.insertBefore(wrap, pre);
          wrap.appendChild(pre);
          var btn = doc.createElement('button');
          btn.type = 'button';
          btn.className = 'wp-copy-btn';
          btn.textContent = 'コピー';
          btn.addEventListener('click', function () {
            var text = pre.innerText;
            function done(label) {
              btn.textContent = label;
              setTimeout(function () { btn.textContent = 'コピー'; }, 1200);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () {
                done('コピー済み');
              }).catch(function () {
                done('失敗');
              });
            } else {
              var area = doc.createElement('textarea');
              area.value = text;
              doc.body.appendChild(area);
              area.select();
              doc.execCommand('copy');
              area.remove();
              done('コピー済み');
            }
          });
          wrap.appendChild(btn);
        });
      } catch (err) {
        /* iframe enhancement is best effort */
      }
    }

    var state = readState();
    checkboxes.forEach(function (box) {
      var id = box.getAttribute('data-progress-id');
      box.checked = !!state[id];
      box.addEventListener('change', function () {
        var current = readState();
        current[id] = box.checked;
        writeState(current);
        updateProgress();
      });
    });

    navItems.forEach(function (item) {
      var link = item.querySelector('a');
      if (!link) return;
      link.addEventListener('click', function () {
        var page = item.getAttribute('data-page');
        setActive(page);
      });
    });

    if (frame) {
      frame.addEventListener('load', function () {
        setActive(normalizePage(frame.getAttribute('src') || frame.contentWindow.location.href));
        injectFrameEnhancements();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        writeState({});
        checkboxes.forEach(function (box) {
          box.checked = false;
        });
        updateProgress();
      });
    }

    setActive(frame ? frame.getAttribute('src') : 'learner/cloud-shell-quickstart.ja.html');
    updateProgress();
  })();
</script>
