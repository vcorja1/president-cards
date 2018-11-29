# [President Card Game](https://president-cards.herokuapp.com/)

This application is a two-player card game of President.

## Endpoints

- [/dashboard](https://president-cards.herokuapp.com/dashboard) - To see the user's statistics and game history
- [/play](https://president-cards.herokuapp.com/play) - To play a new game or continue the ongoing one
- [/statistics](https://president-cards.herokuapp.com/statistics) - To see the statistics of all users
- [/games](https://president-cards.herokuapp.com/games) - To see the list of all completed games

## Setup

To run this program locally, make sure you have the latest Node and npm version (specified in `package.json` file).
Next, make sure you have the folder `public/certs` with the following files: `cert.crt` and `cert.key`. This is necessary to set up the self-signed certificate for testing purposes.
Finally, run `$ npm install` to set up all dependencies and `$ npm start` to start the app locally.

For testing and linting, use `$ npm test`.
