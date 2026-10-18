// eslint.config.js
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const { fixupPluginRules } = require('@eslint/compat');
let eslintPluginDiff = null;
try {
  // Only load eslint-plugin-diff if git HEAD exists, preventing 'fatal: bad revision HEAD' crashes
  require('child_process').execSync('git rev-parse --verify HEAD', { stdio: 'ignore' });
  eslintPluginDiff = require('eslint-plugin-diff');
} catch (e) {
  eslintPluginDiff = null;
}

let stylistic;

const runESMImports = async () => {
  stylistic = await import('@stylistic/eslint-plugin').then((d) => d.default);
};

const isFixMode = process.argv.some((arg) => arg === '--fix' || arg === '--fix-dry-run');

const mainLintFiles = [
  './eslint.config.js',
  'tests/**/*.{ts,js}',
  'playwright/**/*.{js,ts}',
  'packages/app/**/*.{js,jsx,ts}',
  'packages/app/plugins/**/*.{js,cjs,mjs}',
  'packages/app/src/test-utils/mocks/codemirror.js',
  'packages/cli/**/*.js',
  'packages/common/**/*.ts',
  'packages/converters/**/*.js',
  'packages/electron/**/*.js',
  'packages/filestore/**/*.ts',
  'packages/schema-types/**/*.ts',
  'packages/js/**/*.js',
  'packages/lang/**/*.js',
  'packages/requests/**/*.ts',
  'packages/requests/**/*.js',
  'packages/tests/**/*.{js,ts}',
  'packages/sqlite/**/*.{js,ts}'
];

module.exports = runESMImports().then(() => defineConfig([
  // Global ignores - must be a standalone object with ONLY ignores
  {
    ignores: [
      '**/node_modules/**/*',
      '**/dist/**/*',
      '**/*.bru',
      'packages/js/src/sandbox/bundle-browser-rollup.js',
      'packages/app/public/static/**/*',
      'packages/app/.next/**/*',
      'packages/electron/web/**/*'
    ]
  },
  {
    plugins: {
      ...(eslintPluginDiff ? { 'diff': fixupPluginRules(eslintPluginDiff) } : {}),
      '@stylistic': stylistic
    },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    files: mainLintFiles,
    rules: {
      ...stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true
      }).rules,
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/curly-newline': ['error', {
        multiline: true,
        minElements: 2,
        consistent: true
      }],
      '@stylistic/function-paren-newline': ['off'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/multiline-ternary': ['off'],
      '@stylistic/padding-line-between-statements': ['off'],
      '@stylistic/semi-style': ['error', 'last'],
      '@stylistic/max-len': ['off'],
      '@stylistic/jsx-one-expression-per-line': ['off'],
      '@stylistic/max-statements-per-line': ['off'],
      '@stylistic/no-mixed-operators': ['off'],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-debugger': 'warn',
      'eqeqeq': isFixMode ? 'off' : ['warn', 'always'],
      'prefer-const': isFixMode ? 'off' : 'warn',
      'no-var': 'warn',
      'no-unreachable': 'warn',
      'no-duplicate-imports': 'warn',
      'no-self-compare': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-use-before-define': ['warn', { functions: false }]
    }
  },
  {
    files: ['packages/app/**/*.{js,jsx,ts}'],
    ignores: ['**/*.config.js', '**/public/**/*', '**/plugins/**/*'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        global: false,
        require: false,
        Buffer: false,
        process: false,
        ipcRenderer: false,
        __BRUNO_BENCHMARK__: false
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    // Rsbuild/rspack plugins are Node build tooling (CommonJS + ESM), not browser UI.
    files: ['packages/app/plugins/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/app/**/*.{js,jsx,ts}'],
    ignores: ['**/*.config.js', '**/public/**/*', '**/plugins/**/*'],
    plugins: { 'react-hooks': require('eslint-plugin-react-hooks') },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    // It prevents lint errors when using CommonJS exports (module.exports) in Jest mocks.
    files: ['packages/app/src/test-utils/mocks/codemirror.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    // Storybook config files use CommonJS with __dirname and module.exports
    files: ['packages/app/storybook/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/cli/**/*.js'],
    ignores: ['**/*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/common/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/common/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/converters/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-case-declarations': 'error'
    }
  },
  {
    files: ['packages/electron/**/*.js'],
    ignores: ['**/*.config.js', '**/web/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/filestore/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/filestore/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/js/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        window: false,
        self: false,
        HTMLElement: false,
        typeDetectGlobalObject: false
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/lang/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/requests/**/*.ts'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './packages/requests/tsconfig.json'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  },
  {
    files: ['packages/requests/**/*.js'],
    ignores: ['**/*.config.js', '**/dist/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error'
    }
  }
]));
