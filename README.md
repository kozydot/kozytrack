# KozyTrack

KozyTrack is a simple Discord bot that shows what you're currently jamming to on Spotify in a specific channel.
## What it Does

-   Checks your Spotify playback status every 5 seconds.
-   If you're playing a song, it grabs the details (song name, artist, album, album art).
-   Deletes its last status message and posts a new one in the channel you choose, keeping it at the bottom.
-   Uses the dominant color from the album art for the embed color.
-   Includes a little Spotify icon in the footer.
-   If you stop playing, it updates the message to show nothing's playing.
-   Includes a "Find Lyrics" button on the status message to look up lyrics for the current song using Genius.

## Project Structure

The code is organized into modules inside the `src/` folder:
-   `index.js`: Main startup file.
-   `config.js`: Handles `config.json` (stored in `data/config.json`).
-   `discordHandler.js`: Manages Discord connection and message sending/deleting.
-   `spotify.js`: Handles Spotify connection and data fetching.
-   `authServer.js`: Runs the temporary server for Spotify login.
-   `polling.js`: Contains the logic for checking Spotify periodically.
-   `embeds.js`: Creates the pretty message embeds.
-   `logger.js`: Custom logger setup.
-   `utils.js`: Helper functions.
-   `commands/`: Holds the slash command logic (`channelSet.js`, `fetchLyrics.js` - note: `fetchLyrics.js` now only contains the handler used by the button).

## Getting Started (Local Development)

1.  **Clone/Download:** Get the code onto your machine.
2.  **Install Stuff:** Open your terminal in the project folder and run `npm install`.
3.  **Secrets (`.env` file):**
    *   Create a file named `.env` in the main project folder.
    *   Add the following keys with your values:
        *   `DISCORD_BOT_TOKEN=` Your Discord bot's token (from Discord Developer Portal).
        *   `SPOTIFY_CLIENT_ID=` Your Spotify app's Client ID (from Spotify Developer Dashboard).
        *   `SPOTIFY_CLIENT_SECRET=` Your Spotify app's Client Secret.
        *   `GENIUS_API_TOKEN=` Your Genius API Client Access Token (from [Genius API Clients](https://genius.com/api-clients)).
        *   `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback` (Optional for local, will default if not set. **Required for deployment** - see Deployment section).
4.  **Spotify App Setup (for Local):**
    *   Go to your app settings on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
    *   Find the "Redirect URIs" section.
    *   Add this exact URI for local testing: `http://127.0.0.1:8888/callback`
    *   Save the settings!
5.  **Deploy Commands:** Run `npm run deploy` (or `node deploy-commands.js`) in your terminal. This tells Discord about the `/channelset` command. You only need to do this once unless you change the command definition.
6.  **Run the Bot:** Run `npm start` in your terminal (this runs `node src/index.js`).

## How to Use

1.  **First Run - Spotify Auth:**
    *   When you run `npm start` for the first time (or if your token expires), check the terminal.
    *   It will print a long Spotify URL. Copy and paste that into your browser.
    *   Log in to Spotify and click "Agree" to let the bot see your playback status.
    *   You'll get redirected to a page saying "Authorization successful!". You can close that browser tab. The bot will save the necessary token (in `data/config.json`).
2.  **Set the Status Channel:**
    *   In your Discord server, go to any channel and use the slash command `/channelset`.
    *   Select the text channel where you want the Spotify status message to appear.
    *   The bot will confirm, and you're good to go!
3.  **Fetch Lyrics (Optional):**
    *   When the bot posts a "Now Playing" status message, click the "Find Lyrics" button below the embed.
    *   The bot will attempt to find the lyrics using the Genius API and display them in a new embed. (Note: Lyrics might not always be available or perfectly accurate).

Now, just play music on Spotify, and the bot should start updating the status message in the channel you selected!

## Deployment (e.g., Railway.com)

1.  **Environment Variables:** Set the following environment variables in your hosting provider's settings (e.g., Railway service variables):
    *   `DISCORD_BOT_TOKEN`
    *   `SPOTIFY_CLIENT_ID`
    *   `SPOTIFY_CLIENT_SECRET`
    *   `GENIUS_API_TOKEN`
    *   `SPOTIFY_REDIRECT_URI`: **Crucial!** This must be the public URL provided by your hosting platform, ending in `/callback`. Example for Railway: `https://your-app-name.up.railway.app/callback`.
    *   `NODE_ENV`: Set this to `production`.
2.  **Spotify Redirect URI:** Add the exact same public URL used for `SPOTIFY_REDIRECT_URI` (e.g., `https://your-app-name.up.railway.app/callback`) to the allowed Redirect URIs in your Spotify Developer Dashboard settings.
3.  **Deploy Commands:** Ensure you have run `node deploy-commands.js` locally at least once to register the `/channelset` command with Discord before deploying.
4.  **Persistent Volume:** Configure a persistent volume mounted at `/app/data` (or your application's equivalent data directory path) in your hosting provider's settings. This is essential to store the `config.json` file containing the Spotify refresh token and target channel ID across deployments.
5.  **Deployment:** Deploy via your hosting provider's connection to your Git repository (e.g., GitHub).
6.  **First Run Auth:** You will need to perform the Spotify browser authorization flow once after the initial deployment to get the refresh token saved to the persistent volume. Subsequent deployments should automatically use the saved token.

Enjoy!
