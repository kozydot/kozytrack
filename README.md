# KozyTrack 🎧

KozyTrack is a simple Discord bot that shows what you're currently jamming to on Spotify in a specific channel.
## What it Does ✨

-   Checks your Spotify playback status every 5 seconds.
-   If you're playing a song, it grabs the details (song name, artist, album, album art).
-   Deletes its last status message and posts a new one in the channel you choose, keeping it at the bottom.
-   Includes a little Spotify icon in the footer.
-   If you stop playing, it updates the message to show nothing's playing.
-   Includes a `/fetchlyrics` command to look up lyrics for the current song using Genius.

## Project Structure 🏗️

The code is organized into modules inside the `src/` folder:
-   `index.js`: Main startup file.
-   `config.js`: Handles `config.json`.
-   `discordHandler.js`: Manages Discord connection and message sending/deleting.
-   `spotify.js`: Handles Spotify connection and data fetching.
-   `authServer.js`: Runs the temporary server for Spotify login.
-   `polling.js`: Contains the logic for checking Spotify periodically.
-   `embeds.js`: Creates the pretty message embeds.
-   `commands/`: Holds the slash command logic (`channelSet.js`, `fetchLyrics.js`).

## Getting Started 🚀

1.  **Clone/Download:** Get the code onto your machine.
2.  **Install Stuff:** Open your terminal in the project folder and run `npm install`.
3.  **Secrets (`.env` file):**
    *   Create a file named `.env` in the main project folder.
    *   You'll need some keys:
        *   `DISCORD_BOT_TOKEN=` Your Discord bot's token (from Discord Developer Portal).
        *   `SPOTIFY_CLIENT_ID=` Your Spotify app's Client ID (from Spotify Developer Dashboard).
        *   `SPOTIFY_CLIENT_SECRET=` Your Spotify app's Client Secret.
        *   `GENIUS_API_TOKEN=` Your Genius API Client Access Token (from [Genius API Clients](https://genius.com/api-clients)).
4.  **Spotify App Setup:**
    *   Go to your app settings on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
    *   Find the "Redirect URIs" section.
    *   Add this exact URI: `http://127.0.0.1:8888/callback`
    *   Save the settings!
5.  **Deploy Commands:** Run `npm run deploy` in your terminal. This tells Discord about the `/channelset` and `/fetchlyrics` commands. You only need to do this once unless you change the commands later.
6.  **Run the Bot:** Run `npm start` in your terminal (this runs `src/index.js`).

## How to Use 🤔

1.  **First Run - Spotify Auth:**
    *   When you run `npm start` for the first time (or if your token expires), check the terminal.
    *   It will print a long Spotify URL. Copy and paste that into your browser.
    *   Log in to Spotify and click "Agree" to let the bot see your playback status.
    *   You'll get redirected to a page saying "Authorization successful!". You can close that browser tab. The bot will save the necessary token.
2.  **Set the Status Channel:**
    *   In your Discord server, go to any channel and use the slash command `/channelset`.
    *   Select the text channel where you want the Spotify status message to appear.
    *   The bot will confirm, and you're good to go!
3.  **Fetch Lyrics (Optional):**
    *   While a song is playing on Spotify, use the `/fetchlyrics` command in any channel.
    *   The bot will attempt to find the lyrics using the Genius API and display them in an embed. (Note: Lyrics might not always be available or perfectly accurate, as it depends on Genius data and scraping).

Now, just play music on Spotify, and the bot should start updating the status message (by deleting the old one and sending a new one) in the channel you selected!

Enjoy! 🎉
