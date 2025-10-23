// Fetch components/nav.html and inject only the sidebar into the current page.
// Also apply the active class and enforce canonical order at runtime.
(async function(){
  try{
    const res = await fetch('./components/nav.html', {cache: 'no-store'});
    if(!res.ok) return;
    const text = await res.text();
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    const sidebar = tmp.querySelector('.sidebar');
    const main = document.querySelector('main');
    if(sidebar && main){
      // avoid inserting if page already has a sidebar
      if(!document.querySelector('.sidebar')){
        main.parentNode.insertBefore(sidebar, main);
      }
    }

    // helper: set active link and reorder items to canonical order
    const applyNavFixes = ()=>{
      const path = location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.sidebar .nav-link').forEach(a=>{
        const href = a.getAttribute('href') || '';
        if(href === path || (href === './' && path === 'index.html')){
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      });

      const desired = ['index.html','new-delivery.html','history.html','customers.html','reports.html','machine-admin.html','sign-delivery.html'];
      const ul = document.querySelector('.sidebar .nav.flex-column');
      if(!ul) return;
      const map = new Map();
      Array.from(ul.children).forEach(li=>{
        const a = li.querySelector('a'); if(!a) return; const href = (a.getAttribute('href')||'').split('/').pop(); map.set(href, li);
      });
      desired.forEach(href=>{ const li = map.get(href); if(li) ul.appendChild(li); });
    };

    // Run now and after a short delay in case other scripts modify nav
    applyNavFixes();
    setTimeout(applyNavFixes, 250);
  }catch(e){
    console.warn('include-nav: failed to inject sidebar', e);
  }
})();
