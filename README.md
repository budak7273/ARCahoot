# ARCahoot

Multi-client online quiz game, in the style of Kahoot, written to learn about using websockets.

Find the live site at [https://arcahoot.web.app/](https://arcahoot.web.app/)

To become the game host, add `?perm=button` to the end of the URL, like this: [https://arcahoot.web.app/?perm=button](https://arcahoot.web.app/?perm=button)

Right now every player joins the same 'room,' and the questions are always in the same order. This might be changed down the line if we decide to keep working on this.

Reconnecting logic exists for clients - if a client has not been connected for 40 seconds, they will be dropped.

The backend Node.js server is deployed via a free Heroku dyno that can be accessed [here](https://arcahoot.herokuapp.com/).

## Turn-in Info

[Link to our repo](https://github.com/budak7273/arcahoot)

Since we presented in class, we did not record a demo video.

In our zipped turn-in copy, we have left out the node_modules folder to cut down on zip size.

Packages we used:

- [Firebase Hosting](https://firebase.google.com/docs/hosting) to host our frontend page
- [express](https://www.npmjs.com/package/express) for hosting the HTTP server to open the websocket connection with
- [ws](https://www.npmjs.com/package/ws) for the Node.js websocket
- [random-color](https://www.npmjs.com/package/random-color) to generate player colors
- [project-name-generator](https://www.npmjs.com/package/project-name-generator) to generate player names
- [uuid](https://www.npmjs.com/package/uuid) to generate UUIDs for players for reconnect identification

## ARCahoot-frontend

The frontend files managed by firebase hosting are currently in the `/frontend/` folder
because Heroku seems to require the root directory to be the project it deploys.
We should probably move it later.

See the README in that folder for info on the frontend.

## ARCahoot-backend

Backend for the ARCahoot project. Manages connections with clients and runs games. Does not serve website files to client - frontend's Firebase hosting does that.

### Backend Usage

To get started, run `npm install`.

To start a server instance, run `npm start`, or `heroku local`.

### Development

Make sure you have Node.js installed.

Use `npm install` to get dependencies. It will also install ESLint for you in this repo.

Currently listens on port 8000 for consistency with the Heroku deploy.

Use ESLint to ensure you follow style conventions. Follow the directions in `eslint-setup.md` to set up ESLint.

### Deploy to Heroku

Since we do not currently use Heroku to serve the frontend, this deploy only needs to happen when changes to the backend is made. To deploy the frontend, follow the directions in its readme instead.

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

To turn off the deployment, scale the app down to 0 instances.

```bash
heroku ps:scale web=0
```

To turn on the deployment, scale the app to 1 instance instead of 0. Project not currently designed to support multiple instances.
