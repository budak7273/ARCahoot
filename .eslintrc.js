module.exports = {
	'env': {
		'browser': true,
		'es2021': true,
	},
	'extends': [
		'google',
	],
	'parserOptions': {
		'ecmaVersion': 12,
	},
	'ignorePatterns': [
		'**/*.min.js',
		'popper.js',
	],
	'rules': {
		// Ask first in the Discord before changing these.
		//
		// If you don't want a rule to apply in an area of the code,
		// you should disable it for a block or line of code.
		// https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments
		//
		// Wondering what a rule does? https://eslint.org/docs/rules/

		'indent': ['warn', 'tab'],
		'require-jsdoc': 'off',
		'spaced-comment': 'warn',
		'linebreak-style': 'off',
		'max-len': [
			'warn',
			{
				'code': 150,
				'ignoreRegExpLiterals': true,
				'ignoreUrls': true,
			},
		],
		'no-unused-vars': 'warn',
		'new-cap': 'error',

		'no-warning-comments': 'warn',

		'no-template-curly-in-string': 'error',
		'no-useless-concat': 'warn',
		'template-curly-spacing': ['error', 'never'],
		'prefer-template': 'error',

		// 'quotes': ['warn', 'double'],
		'quotes': 'off',
		'camelcase': 'off',
		'no-tabs': 'off',
		'space-before-function-paren': 'off',
	},
};
