(() => {
  'use strict';
  if (document.querySelector('[data-lab-pass-button]')) return;
  const style = document.createElement('style');
  style.textContent = '.lab-pass-purchase-row{position:relative;z-index:50;display:block;width:100%;max-width:920px;margin:16px auto 20px;padding:0 16px;text-align:center;box-sizing:border-box}.lab-pass-purchase{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:100%;min-height:44px;padding:12px 22px;border-radius:14px;background:linear-gradient(180deg,#ffd76c,#edbd4b);color:#302410!important;font:700 16px/1.5 system-ui,sans-serif;text-align:center;text-decoration:none;overflow-wrap:anywhere;box-shadow:0 6px 18px #9c762b25}.lab-pass-purchase:hover{background:#ffe293}.lab-pass-purchase:focus-visible{outline:2px solid #314b86;outline-offset:3px}#victory .restart{bottom:calc(110px + env(safe-area-inset-bottom,0px))}';
  document.head.appendChild(style);
  let button = document.getElementById('purchase');
  if (!button) {
    const row = document.createElement('div');
    row.className = 'lab-pass-purchase-row';
    button = document.createElement('a');
    row.appendChild(button);
    document.body.appendChild(row);
  }
  button.dataset.labPassButton = 'true';
  button.classList.add('lab-pass-purchase');
  button.textContent = '成功研究所パス';
  button.href = 'https://j.hitopper.top/?fate-buy=574';
  button.target = '_top';
  button.rel = 'noopener noreferrer';
})();
