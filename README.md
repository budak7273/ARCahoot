# ARCahoot

Find the live site at [https://arcahoot.web.app/](https://arcahoot.web.app/)

The backend Node.js server is deployed via a free Heroku dyno that can be accessed [here](https://arcahoot.herokuapp.com/).

## ARCahoot-frontend

The frontend files managed by firebase hosting are currently in the `/frontend/` folder
because Heroku seems to require the root directory to be the project it deploys.
We should probably move it later.

See the README in that folder for info on the frontend.

## ARCahoot-backend

Backend for the ARCahoot project. Manages connections with clients and runs games. Does not serve website files to client - frontend's Firebase hosting does that.

### Usage

To get started, run `npm install`.

To start a server instance, run `npm start`, or `heroku local`.

### Development

Make sure you have Node.js installed.

Use `npm install` to get dependencies. It will also install ESLint for you in this repo.

Currently listens on port 8000 for consistency with the Heroku deploy.

Use ESLint to ensure you follow style conventions. Follow the directions in `eslint-setup.md` to set up ESLint.

### Deploy to Heroku

Make sure you have Heroku CLI set up, as explained [here](https://devcenter.heroku.com/articles/heroku-cli), and linked to your github account.

If you are not part of our dev team, you will need to [create your own Heroku project](https://devcenter.heroku.com/articles/git) instead of using our own.

To add the existing Heroku project as a git remote, run the following:

```bash
heroku git:remote -a arcahoot
```

Once you complete the setup, you should have Heroku configured as another git remote you can push to. This is how you deploy code to it.

To deploy:

```bash
git push heroku main
```
