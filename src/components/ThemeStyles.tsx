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
// there is no flash of the default theme. Only the key is read here; the
// colour values come from the <style> above.
export const THEME_BOOT_SCRIPT = `(function(){try{var k=localStorage.getItem('mini-vault-theme');if(!k)return;var h=document.documentElement;h.setAttribute('data-theme',k);if(k==='aurora-glass')h.classList.add('theme-3d');if(k==='leather-chrome')h.classList.add('theme-leather');}catch(e){}})();`;
