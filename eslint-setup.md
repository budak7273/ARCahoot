# Get ESLint working

1. Install [NPM](https://www.npmjs.com/get-npm).
2. Open a terminal inside the project folder (either the `frontend` or `backend` folder) and type `npm install`
3. Install the ESLint plugin for VSCode
4. Open one of the project's JS files and click this button. If you don't see the button, relaunch VSCode.

![ESLint Button](https://i.imgur.com/uq5pgwT.png)

5. Click 'Allow' or 'Allow Everywhere' according to your preference. Everywhere means it should always look in repos for an node_modules/eslint and use that eslint version (probably what you want)
6. ESLint should now be enabled and yelling at you for things that break style (there shouldn't be any of these when you first load eslint). To test this, make a TODO comment somewhere, and it should make a warning about it.
7. Check out `.eslintrc.js` for more info
8. VSCode can autofix some complaints, press `Ctrl+.` when your cursor is in the error. It can also bring you to the docs page for the rule.
9. Pushing code with eslint warnings is tolerable but errors would not be very cash money of you.
