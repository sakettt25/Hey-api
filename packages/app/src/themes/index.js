import light from './light/light';
import catppuccinLatte from './light/catppuccin-latte';
import vscodeLight from './light/vscode';

import dark from './dark/dark';
import dracula from './dark/dracula';
import nord from './dark/nord';

// Fallback theme imports to preserve backward compatibility for users with previously saved theme settings in localStorage
import lightMonochrome from './light/light-monochrome';
import lightPastel from './light/light-pastel';
import { gruvboxLightSoft, gruvboxLightMedium, gruvboxLightHard } from './light/gruvbox';
import cyberdreamLight from './light/cyberdream-light';
import darkMonochrome from './dark/dark-monochrome';
import darkPastel from './dark/dark-pastel';
import catppuccinFrappe from './dark/catppuccin-frappe';
import catppuccinMacchiato from './dark/catppuccin-macchiato';
import catppuccinMocha from './dark/catppuccin-mocha';
import { gruvboxDarkSoft, gruvboxDarkMedium, gruvboxDarkHard } from './dark/gruvbox';
import vscodeDark from './dark/vscode';
import cyberdreamDark from './dark/cyberdream-dark';

const themes = {
  // 3 Light themes
  light,
  'catppuccin-latte': catppuccinLatte,
  'vscode-light': vscodeLight,

  // 3 Dark themes
  dark,
  dracula,
  nord,

  // Compatibility fallbacks for deprecated variants
  'light-monochrome': lightMonochrome,
  'light-pastel': lightPastel,
  'dark-monochrome': darkMonochrome,
  'dark-pastel': darkPastel,
  'catppuccin-frappe': catppuccinFrappe,
  'catppuccin-macchiato': catppuccinMacchiato,
  'catppuccin-mocha': catppuccinMocha,
  'gruvbox-light-soft': gruvboxLightSoft,
  'gruvbox-light-medium': gruvboxLightMedium,
  'gruvbox-light-hard': gruvboxLightHard,
  'gruvbox-dark-soft': gruvboxDarkSoft,
  'gruvbox-dark-medium': gruvboxDarkMedium,
  'gruvbox-dark-hard': gruvboxDarkHard,
  'vscode-dark': vscodeDark,
  'cyberdream-light': cyberdreamLight,
  'cyberdream-dark': cyberdreamDark
};

// Theme metadata for UI display - precisely 3 light and 3 dark themes
export const themeRegistry = {
  // Light Themes (3)
  'light': {
    id: 'light',
    name: 'Solaris Aurora',
    mode: 'light'
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte',
    name: 'Arctic Opal',
    mode: 'light'
  },
  'vscode-light': {
    id: 'vscode-light',
    name: 'Alabaster Luxe',
    mode: 'light'
  },

  // Dark Themes (3)
  'dark': {
    id: 'dark',
    name: 'Obsidian Eclipse',
    mode: 'dark'
  },
  'dracula': {
    id: 'dracula',
    name: 'Cyber Neon',
    mode: 'dark'
  },
  'nord': {
    id: 'nord',
    name: 'Nordic Frost',
    mode: 'dark'
  }
};

export const getLightThemes = () => Object.values(themeRegistry).filter((t) => t.mode === 'light');
export const getDarkThemes = () => Object.values(themeRegistry).filter((t) => t.mode === 'dark');

export default themes;
