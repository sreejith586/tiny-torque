import { THEMES } from '@/lib/theme';

// Server component: emits one [data-theme="…"] block per theme straight from
// THEMES (single source of truth, D-027) so first paint is correct before JS,
// and Tailwind semantic colours resolve without any inline-style step.
export default function ThemeStyles() {
  const css = Object.entries(THEMES)
    .map(([key, def]) => {
      const vars = Object.entries(def.vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';');
      return `[data-theme="${key}"]{${vars}}`;
    })
    .join('\n');
  return <style id="mv-themes" dangerouslySetInnerHTML={{ __html: css }} />;
}

// Runs before hydration: restores the stored theme key + modifier classes so
// there is no flash. When nothing is stored the SSR default (Aurora Glass +
// theme-3d, set on <html> in layout.tsx — D-054) stands. For a stored theme we
// `toggle` the modifier classes rather than only adding them, so switching away
// from the Aurora default doesn't leave its glass class on the element. Only the
// key is read here; the colour values come from the <style> above.
export const THEME_BOOT_SCRIPT = `(function(){try{var k=localStorage.getItem('mini-vault-theme');if(!k)return;var h=document.documentElement;h.setAttribute('data-theme',k);h.classList.toggle('theme-3d',k==='aurora-glass');h.classList.toggle('theme-leather',k==='leather-chrome');}catch(e){}})();`;
