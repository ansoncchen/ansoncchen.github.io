// Last.fm "now playing" widget.
// ─────────────────────────────────────────────────────────────
// SETUP (two steps, ~1 minute):
//   1. Put your Last.fm username below.
//   2. Create a free API key at https://www.last.fm/api/account/create
//      (fill in any name/description, leave callback URL blank) and paste
//      the "API key" it gives you below.
// The API key is read-only, so it's safe to live here in client-side code.
// Make sure Spotify is connected to your Last.fm account so plays scrobble.
// ─────────────────────────────────────────────────────────────
(() => {
  const LASTFM_USER = "Capanator";
  const LASTFM_API_KEY = "3f977219d13418411edd34fcdc8addad";
  const REFRESH_MS = 60000;

  // Bail quietly if not configured yet — widget stays hidden.
  if (
    LASTFM_USER === "YOUR_LASTFM_USERNAME" ||
    LASTFM_API_KEY === "YOUR_LASTFM_API_KEY"
  ) {
    return;
  }

  const root = document.getElementById("now-playing");
  if (!root) return;

  const artEl = document.getElementById("np-art");
  const labelEl = document.getElementById("np-label");
  const trackEl = document.getElementById("np-track");
  const artistEl = document.getElementById("np-artist");

  const endpoint =
    "https://ws.audioscrobbler.com/2.0/" +
    "?method=user.getrecenttracks" +
    "&user=" + encodeURIComponent(LASTFM_USER) +
    "&api_key=" + encodeURIComponent(LASTFM_API_KEY) +
    "&format=json&limit=1";

  const render = (track) => {
    if (!track) {
      root.hidden = true;
      return;
    }

    const nowPlaying = track["@attr"] && track["@attr"].nowplaying === "true";
    const name = track.name || "";
    const artist = (track.artist && (track.artist["#text"] || track.artist.name)) || "";
    // Last.fm returns image sizes small/medium/large/extralarge — take the largest.
    const images = Array.isArray(track.image) ? track.image : [];
    const art = images.length ? images[images.length - 1]["#text"] : "";
    const url = track.url || "#";

    trackEl.textContent = name;
    artistEl.textContent = artist;
    labelEl.textContent = nowPlaying ? "now playing" : "last played";
    root.href = url;
    root.classList.toggle("now-playing--live", nowPlaying);

    if (art) {
      artEl.src = art;
      artEl.alt = name ? `Album art for ${name}` : "Album art";
      artEl.hidden = false;
    } else {
      artEl.hidden = true;
    }

    root.hidden = false;
  };

  const update = async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`Last.fm ${res.status}`);
      const data = await res.json();
      const tracks = data && data.recenttracks && data.recenttracks.track;
      const track = Array.isArray(tracks) ? tracks[0] : tracks;
      render(track);
    } catch (err) {
      console.error("now-playing: failed to fetch Last.fm data", err);
      // Keep whatever was last shown; don't flash the widget away on a blip.
    }
  };

  update();
  setInterval(update, REFRESH_MS);
})();
