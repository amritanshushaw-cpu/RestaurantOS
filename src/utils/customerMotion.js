/**
 * Motion layer for the hand-painted RestaurantOS customer landing page.
 * The page structure and visual timings mirror the approved canvas design.
 */
(function initCustomerMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mosaic = document.getElementById('mosaic');
  const tiles = mosaic ? Array.from(mosaic.querySelectorAll('.tile')) : [];
  const heroHeading = document.getElementById('heroH1');

  tiles.forEach((tile, index) => {
    tile.style.setProperty('--i', index);
    if (!reduce) {
      tile.style.setProperty('--dx', `${Math.round(Math.random() * 440 - 220)}px`);
      tile.style.setProperty('--dy', `${Math.round(Math.random() * 360 - 180)}px`);
      tile.style.setProperty('--r', `${(Math.random() * 28 - 14).toFixed(1)}deg`);
    }
  });

  const settleTiles = () => {
    tiles.forEach((tile) => tile.classList.add('in'));
    window.setTimeout(() => mosaic?.classList.add('ready'), 1100);
  };

  const revealHero = () => heroHeading?.classList.add('revealed');
  if (reduce) {
    settleTiles();
    revealHero();
  } else {
    window.addEventListener('load', () => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(settleTiles));
      window.setTimeout(revealHero, 520);
    }, { once: true });
    window.setTimeout(() => {
      if (mosaic && tiles[0] && !tiles[0].classList.contains('in')) {
        settleTiles();
        revealHero();
      }
    }, 300);
  }

  const grain = document.querySelector('.grain');
  const menuSection = document.querySelector('[data-menu]');
  const rows = menuSection ? Array.from(menuSection.querySelectorAll('.row')) : [];
  const stepNumbers = Array.from(document.querySelectorAll('[data-num]'));
  const orderSection = document.getElementById('order');
  const marquee = document.getElementById('marquee');
  let scrollY = 0;
  let lastScrollY = 0;
  let velocity = 0;
  let marqueeX = 0;
  let marqueeWidth = marquee ? marquee.scrollWidth / 2 : 0;
  let ticking = false;

  const clamp = (value) => Math.min(1, Math.max(0, value));

  function update() {
    if (grain && !reduce) grain.style.transform = `translateY(${scrollY * 0.06}px)`;
    if (mosaic && !reduce) mosaic.style.transform = `translateY(${-scrollY * 0.04}px)`;

    if (menuSection && rows.length && !reduce) {
      const rect = menuSection.getBoundingClientRect();
      const progress = clamp((window.innerHeight * 0.85 - rect.top) / (rect.height * 0.55 + window.innerHeight * 0.4));
      const revealCount = Math.floor(progress * rows.length * 1.15);
      rows.forEach((row, index) => {
        if (index <= revealCount) row.classList.add('shown');
      });
    }

    if (orderSection && stepNumbers.length && !reduce) {
      const rect = orderSection.getBoundingClientRect();
      const progress = clamp((window.innerHeight - rect.top) / (rect.height + window.innerHeight));
      stepNumbers.forEach((number, index) => {
        number.style.setProperty('--ny', `${((1 - progress) * (24 + index * 6)).toFixed(1)}px`);
      });
    }

    if (marquee && marqueeWidth) {
      marqueeX -= 0.6 + Math.min(Math.abs(velocity) * 0.12, 7);
      if (marqueeX <= -marqueeWidth) marqueeX += marqueeWidth;
      marquee.style.transform = `translateX(${marqueeX}px)`;
      velocity *= 0.9;
    }
    ticking = false;
  }

  function onScroll() {
    scrollY = window.scrollY || window.pageYOffset;
    velocity = scrollY - lastScrollY;
    lastScrollY = scrollY;
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    marqueeWidth = marquee ? marquee.scrollWidth / 2 : 0;
  });

  (function loop() {
    window.requestAnimationFrame(loop);
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }());

  function makeObserver(callback, threshold = 0.2) {
    return new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) callback(entry.target);
      });
    }, { threshold });
  }

  document.querySelectorAll('[data-anim]').forEach((heading) => {
    heading.style.transition = 'transform .8s var(--ease), opacity .8s var(--ease), filter .8s var(--ease), letter-spacing .8s var(--ease)';
    if (reduce) return;
    if (heading.classList.contains('anim-skew')) {
      heading.style.transform = 'translateY(40px) skewY(7deg)';
      heading.style.opacity = '0';
    }
    if (heading.classList.contains('anim-blur')) {
      heading.style.filter = 'blur(16px)';
      heading.style.opacity = '0';
    }
    if (heading.classList.contains('anim-track')) {
      heading.style.letterSpacing = '.32em';
      heading.style.opacity = '.3';
    }
  });

  const headingObserver = makeObserver((heading) => {
    heading.style.transform = 'none';
    heading.style.opacity = '1';
    heading.style.filter = 'none';
    heading.style.letterSpacing = '-.02em';
    headingObserver.unobserve(heading);
  }, 0.4);
  document.querySelectorAll('[data-anim]').forEach((heading) => headingObserver.observe(heading));

  if (menuSection && rows.length) {
    const rowObserver = makeObserver((category) => {
      category.querySelectorAll('.row').forEach((row) => row.classList.add('shown'));
      rowObserver.unobserve(category);
    }, 0.45);
    menuSection.querySelectorAll('.cat').forEach((category) => rowObserver.observe(category));
  }

  const favoriteItems = Array.from(document.querySelectorAll('.reg-item'));
  const favoriteList = document.getElementById('regList');
  if (favoriteItems.length && favoriteList) {
    const favoriteObserver = makeObserver(() => {
      favoriteItems.forEach((item, index) => {
        window.setTimeout(() => item.classList.add('in'), reduce ? 0 : index * 90);
      });
      favoriteObserver.disconnect();
    }, 0.25);
    favoriteObserver.observe(favoriteList);
  }

  const bento = document.getElementById('bento');
  if (bento) {
    const bentoObserver = makeObserver(() => {
      bento.classList.add('in');
      bentoObserver.disconnect();
    }, 0.2);
    bentoObserver.observe(bento);
  }

  const footer = document.getElementById('footer');
  if (footer) {
    const footerStripe = document.getElementById('fstripe');
    const footerName = document.getElementById('fname');
    const footerColumns = Array.from(footer.querySelectorAll('.fcol'));
    const footerObserver = makeObserver(() => {
      footerStripe?.classList.add('in');
      footerName?.classList.add('in');
      footerColumns.forEach((column, index) => {
        window.setTimeout(() => column.classList.add('in'), reduce ? 0 : 120 + index * 120);
      });
      footerObserver.disconnect();
    }, 0.25);
    footerObserver.observe(footer);
  }

  const preview = document.getElementById('preview');
  const previewImage = preview?.querySelector('img');
  const regulars = document.getElementById('regulars');
  if (preview && previewImage && favoriteList && window.matchMedia('(hover:hover)').matches && !reduce) {
    favoriteItems.forEach((item) => {
      item.addEventListener('mouseenter', () => {
        previewImage.src = item.dataset.img || '';
        regulars?.classList.add('dim');
        item.classList.add('hot');
        preview.classList.add('show');
      });
      item.addEventListener('mouseleave', () => {
        item.classList.remove('hot');
        preview.classList.remove('show');
        regulars?.classList.remove('dim');
      });
    });

    let pointerX = 0;
    let pointerY = 0;
    let pointerTicking = false;
    regulars?.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerTicking) return;
      pointerTicking = true;
      window.requestAnimationFrame(() => {
        preview.style.left = `${pointerX}px`;
        preview.style.top = `${pointerY}px`;
        pointerTicking = false;
      });
    });
  }
}());
