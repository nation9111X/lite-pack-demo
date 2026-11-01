export function initAnimationVisibility() {
  const selector = '.box-float,.box-shadow,.hero__tag,.ftr__track,.theme-btn__ico,.btn,.addr-chip__value,.hero__hint';
  const known = new WeakSet<Element>();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.target.classList.toggle('perf-paused', !e.isIntersecting);
  });
  let frame = 0;
  const scan = () => {
    frame = 0;
    document.querySelectorAll(selector).forEach(el => {
      if (known.has(el)) return;
      known.add(el); el.classList.add('perf-watch'); io.observe(el);
    });
  };
  new MutationObserver(records => {
    for (const record of records) for (const node of record.removedNodes) {
      if (!(node instanceof Element) || node.isConnected) continue;
      const remove = (el: Element) => { io.unobserve(el); known.delete(el); };
      remove(node); node.querySelectorAll('.perf-watch').forEach(remove);
    }
    if (!frame) frame = requestAnimationFrame(scan);
  })
    .observe(document.body, { childList: true, subtree: true });
  const visibility = () => document.documentElement.classList.toggle('perf-hidden', document.hidden);
  document.addEventListener('visibilitychange', visibility);
  visibility(); scan();
}
