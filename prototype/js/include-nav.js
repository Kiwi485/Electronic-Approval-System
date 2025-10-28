// Fetch components/nav.html and inject only the sidebar into the current page.
// Also apply the active class and enforce canonical order at runtime.
(async function(){
  try{
    const res = await fetch('./components/nav.html?navVersion=20251024c', {cache: 'no-store'});
    if(!res.ok) return;
    const text = await res.text();
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    const sidebar = tmp.querySelector('.sidebar');
    const main = document.querySelector('main');
    const injectSidebar = document.body?.dataset?.noSidebar !== 'true';
    if(sidebar && main && injectSidebar){
      if(!document.querySelector('.sidebar')){
        main.parentNode.insertBefore(sidebar, main);
      }
    }

    const mobileNavTemplate = tmp.querySelector('.mobile-nav');
    if(mobileNavTemplate && !document.querySelector('.mobile-nav')){
      const clone = mobileNavTemplate.cloneNode(true);
      document.body.appendChild(clone);
    }
    if(document.querySelector('.mobile-nav')){
      document.body.classList.add('has-mobile-nav');
    }

    // helper: set active link and reorder items to canonical order
    const applyNavFixes = ()=>{
      const path = location.pathname.split('/').pop() || 'index.html';
      const sidebarOrder = [
        'index.html',
        'new-delivery.html',
        'history.html',
        'reports.html',
        'driver-admin.html',
        'machine-admin.html',
        'sign-delivery.html'
      ];
      const normalizeHref = (href='')=>(href.split('?')[0]||'').split('/').pop();

      document.querySelectorAll('.sidebar .nav-link').forEach(a=>{
        const target = normalizeHref(a.getAttribute('href'));
        if(target === path || (target === '' && path === 'index.html')){
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      });

      const ul = document.querySelector('.sidebar .nav.flex-column');
      if(ul){
        const map = new Map();
        Array.from(ul.children).forEach(li=>{
          const a = li.querySelector('a');
          if(!a) return;
          const href = normalizeHref(a.getAttribute('href'));
          if(!href) return;
          map.set(href, li);
        });
        sidebarOrder.forEach(href=>{
          const li = map.get(href);
          if(li) ul.appendChild(li);
        });
      }

      const mobileNav = document.querySelector('.mobile-nav .nav-links');
      if(mobileNav){
        const mobileOrder = [
          'index.html',
          'new-delivery.html',
          'history.html',
          'reports.html',
          'driver-admin.html',
          'machine-admin.html',
          'sign-delivery.html'
        ];
        const items = Array.from(mobileNav.querySelectorAll('a'));
        const itemMap = new Map();
        items.forEach(a=>itemMap.set(normalizeHref(a.getAttribute('href')), a));
        mobileOrder.forEach(href=>{
          const anchor = itemMap.get(href);
          if(anchor) mobileNav.appendChild(anchor);
        });
        items.forEach(a=>{
          const target = normalizeHref(a.getAttribute('href'));
          const active = target === path;
          a.classList.toggle('text-primary', active);
          a.classList.toggle('text-secondary', !active);
        });
      }
    };

    // Run now and after a short delay in case other scripts modify nav
    applyNavFixes();
    setTimeout(applyNavFixes, 250);
    document.dispatchEvent(new CustomEvent('nav-ready'));
    setTimeout(() => document.dispatchEvent(new CustomEvent('nav-ready')), 10);
  }catch(e){
    console.warn('include-nav: failed to inject sidebar', e);
  }
})();
