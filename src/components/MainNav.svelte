<script lang="ts">
  /**
   * The main menu. Wide screens (760px and up): a bar of five, Dashboard · Study · Practice · Skills · Culture, the
   * three groups opening a dropdown on hover (with a mouse) or on click/tap/Enter. The group holding the page you're
   * on is highlighted, and so is that page inside its dropdown. Narrower screens: one Menu button opening the whole
   * menu, grouped under the same headings.
   */
  import { href, type Route } from '../lib/router.ts';
  import { NAV, isCurrent, isGroup, type NavGroup, type NavLink } from '../lib/nav.ts';

  let { route, onchoose }: { route: Route; onchoose: (link: NavLink) => void } = $props();

  const wideQuery = typeof matchMedia === 'function' ? matchMedia('(min-width: 760px)') : null;
  let wide = $state(wideQuery?.matches ?? false);
  $effect(() => {
    const on = () => {
      wide = wideQuery?.matches ?? false;
      close();
    };
    wideQuery?.addEventListener('change', on);
    return () => wideQuery?.removeEventListener('change', on);
  });

  let el = $state<HTMLElement>();
  /** Phones: the whole menu. */
  let menuOpen = $state(false);
  /** Wide screens: the open group's id, and whether the mouse opened it (then leaving closes it again). */
  let open = $state<string | null>(null);
  let byHover = false;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  function close() {
    menuOpen = false;
    open = null;
    byHover = false;
  }
  // A new page closes the menu.
  $effect(() => {
    void route;
    close();
  });

  const inGroup = (g: NavGroup) => g.links.some((l) => isCurrent(l, route));

  function toggle(g: NavGroup) {
    clearTimeout(leaveTimer);
    // A click on a group the mouse has just opened keeps it open (a hover then a click shouldn't close it).
    if (open === g.id && !byHover) open = null;
    else open = g.id;
    byHover = false;
  }
  function enter(g: NavGroup, e: PointerEvent) {
    if (e.pointerType !== 'mouse') return; // touch: a tap opens it, through click
    clearTimeout(leaveTimer);
    if (open !== g.id) {
      open = g.id;
      byHover = true;
    }
  }
  function leave(g: NavGroup, e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !byHover || open !== g.id) return;
    leaveTimer = setTimeout(() => {
      if (byHover && open === g.id) open = null;
    }, 250);
  }
  /** Down arrow on a group opens it and moves to its first link; up/down move within it. */
  function onGroupKey(g: NavGroup, e: KeyboardEvent) {
    const links = [...(el?.querySelectorAll<HTMLAnchorElement>(`#nav-${g.id} a`) ?? [])];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (open !== g.id) {
        open = g.id;
        byHover = false;
        requestAnimationFrame(() => el?.querySelector<HTMLAnchorElement>(`#nav-${g.id} a`)?.focus());
        return;
      }
      const at = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = e.key === 'ArrowDown' ? (at + 1) % links.length : (at <= 0 ? links.length : at) - 1;
      links[next]?.focus();
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || (!menuOpen && !open)) return;
    const was = open;
    close();
    const btn = wide ? el?.querySelector<HTMLButtonElement>(`[aria-controls="nav-${was}"]`) : el?.querySelector<HTMLButtonElement>('.menu-btn');
    btn?.focus();
  }
  function onClick(e: MouseEvent) {
    if ((menuOpen || open) && el && !el.contains(e.target as Node)) close();
  }
  /** Tabbing out of an open group closes it. */
  function onFocusOut(g: NavGroup, e: FocusEvent) {
    const li = e.currentTarget as HTMLElement;
    if (open === g.id && !li.contains(e.relatedTarget as Node | null)) open = null;
  }
  function choose(link: NavLink) {
    close();
    onchoose(link);
  }
</script>

<svelte:window onkeydown={onKey} onclick={onClick} />

{#snippet item(link: NavLink, rich: boolean)}
  {@const id = `nav-what-${link.route.page}`}
  <a class="nav-link" class:rich href={href(link.route)} aria-current={isCurrent(link, route) ? 'page' : undefined} aria-describedby={rich && link.what ? id : undefined} onclick={() => choose(link)}>
    <span class="l">{link.label}</span>
    {#if rich && link.what}<span class="what" {id} aria-hidden="true">{link.what}</span>{/if}
  </a>
{/snippet}

<nav aria-label="Main" class="menu" bind:this={el}>
  {#if wide}
    <ul class="bar">
      {#each NAV as n (n.label)}
        {#if isGroup(n)}
          <li class="group" onpointerenter={(e) => enter(n, e)} onpointerleave={(e) => leave(n, e)} onfocusout={(e) => onFocusOut(n, e)}>
            <button type="button" class="nav-link group-btn" class:current={inGroup(n)} aria-expanded={open === n.id} aria-controls="nav-{n.id}" onclick={() => toggle(n)} onkeydown={(e) => onGroupKey(n, e)}>
              {n.label}<svg class="chev" aria-hidden="true" viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            {#if open === n.id}
              <div class="drop" class:end={n.id === 'skills'} id="nav-{n.id}" onkeydown={(e) => onGroupKey(n, e)} role="presentation">
                <div class="panel">
                  <p class="tag">{n.tag}</p>
                  <ul>
                    {#each n.links as l (l.label)}<li>{@render item(l, true)}</li>{/each}
                  </ul>
                </div>
              </div>
            {/if}
          </li>
        {:else}
          <li>{@render item(n, false)}</li>
        {/if}
      {/each}
    </ul>
  {:else}
    <button class="btn menu-btn" type="button" aria-expanded={menuOpen} aria-controls="main-menu" onclick={() => (menuOpen = !menuOpen)}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      Menu
    </button>
    {#if menuOpen}
      <div id="main-menu" class="menu-list">
        {#each NAV as n (n.label)}
          {#if isGroup(n)}
            <p class="m-head" class:current={inGroup(n)}>{n.label} <span class="m-tag">· {n.tag}</span></p>
            <ul>
              {#each n.links as l (l.label)}<li>{@render item(l, false)}</li>{/each}
            </ul>
          {:else}
            <ul class="solo"><li>{@render item(n, false)}</li></ul>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</nav>

<style>
  .menu {
    position: relative;
    margin-left: auto;
    order: 2;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .bar {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px;
  }
  .group {
    position: relative;
  }
  .nav-link {
    display: block;
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
    white-space: nowrap;
    font: inherit;
    font-weight: 700;
  }
  .group-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .chev {
    transition: transform 0.15s;
  }
  .group-btn[aria-expanded='true'] .chev {
    transform: rotate(180deg);
  }
  .nav-link:hover,
  .group-btn[aria-expanded='true'] {
    background: var(--surface-2);
  }
  /* The page you're on, and the group it's in. */
  .nav-link[aria-current='page'],
  .group-btn.current {
    background: var(--primary-bg);
    color: var(--primary-text);
  }
  .drop {
    position: absolute;
    left: 0;
    top: 100%;
    padding-top: 6px; /* inside the box, so moving the mouse down to it doesn't leave the group */
    z-index: 20;
    min-width: 17rem;
  }
  .drop.end {
    left: auto;
    right: 0;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow), 0 8px 24px rgb(0 0 0 / 0.12);
    padding: 0 6px 6px;
  }
  .panel ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag {
    margin: 0;
    padding: 10px 12px 6px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .rich {
    white-space: normal;
    padding: 8px 12px;
  }
  .what {
    display: block;
    font-weight: 400;
    font-size: 0.86rem;
    color: var(--muted);
  }
  .rich[aria-current='page'] .what {
    color: inherit;
  }
  .menu-btn {
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .menu-list {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    padding: 6px;
    min-width: 15rem;
    max-height: calc(100vh - 90px);
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow), 0 8px 24px rgb(0 0 0 / 0.12);
  }
  .menu-list ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu-list ul + ul,
  .menu-list ul + .m-head {
    margin-top: 4px;
  }
  .m-head {
    margin: 4px 0 2px;
    padding: 6px 14px 2px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    border-top: 1px solid var(--border);
  }
  .menu-list .solo:not(:first-child) {
    border-top: 1px solid var(--border);
    padding-top: 4px;
  }
  .m-head.current {
    color: var(--accent);
  }
  .m-tag {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .menu-list .nav-link {
    padding: 9px 14px;
  }
  @media (prefers-reduced-motion: reduce) {
    .chev {
      transition: none;
    }
  }
</style>
