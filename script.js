///////////////
// PARAMETERS //
///////////////

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const client_id = urlParams.get("client_id") || "";
const client_secret = urlParams.get("client_secret") || "";
let refresh_token = urlParams.get("refresh_token") || "";
let access_token = "";

const visibilityDuration = urlParams.get("duration") || 0;
const hideAlbumArt = urlParams.has("hideAlbumArt");

// NEW: slide direction (top, bottom, left, right)
const slideFrom = urlParams.get("slideFrom") || "bottom";

let currentState = false;
let currentSongUri = "";

// DOM refs
const mainContainer = document.getElementById("mainContainer");

/////////////////
// SPOTIFY API //
/////////////////

async function RefreshAccessToken() {
  let body = "grant_type=refresh_token";
  body += "&refresh_token=" + refresh_token;
  body += "&client_id=" + client_id;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(client_id + ":" + client_secret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  if (response.ok) {
    const responseData = await response.json();
    access_token = responseData.access_token;
  } else {
    console.error(`Error refreshing token: ${response.status}`);
  }
}

async function GetCurrentlyPlaying() {
  try {
    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      UpdatePlayer(data);
    } else if (response.status === 401) {
      await RefreshAccessToken();
    } else {
      console.error(`Spotify API error: ${response.status}`);
    }

    setTimeout(GetCurrentlyPlaying, 1000);
  } catch (err) {
    console.error(err);
    SetVisibility(false);
    setTimeout(GetCurrentlyPlaying, 2000);
  }
}

function UpdatePlayer(data) {
  const isPlaying = data.is_playing;
  const songUri = data.item.uri;
  const albumArt =
    data.item.album.images[0]?.url ||
    "images/placeholder-album-art.png";
  const artist = data.item.artists[0].name;
  const name = data.item.name;
  const duration = data.item.duration_ms / 1000;
  const progress = data.progress_ms / 1000;

  // toggle on play/pause or song change
  if (isPlaying !== currentState || songUri !== currentSongUri) {
    if (isPlaying) {
      SetVisibility(true);
      if (visibilityDuration > 0) {
        setTimeout(() => SetVisibility(false, false), visibilityDuration * 1000);
      }
    } else {
      SetVisibility(false);
    }
    currentSongUri = songUri;
  }

  // update UI
  UpdateAlbumArt(document.getElementById("albumArt"), albumArt);
  UpdateAlbumArt(document.getElementById("backgroundImage"), albumArt);
  UpdateTextLabel(document.getElementById("artistLabel"), artist);
  UpdateTextLabel(document.getElementById("songLabel"), name);

  const progressPerc = (progress / duration) * 100;
  document.getElementById("progressBar").style.width = `${progressPerc}%`;
  document.getElementById("progressTime").innerText =
    ConvertSeconds(progress);
  document.getElementById("timeRemaining").innerText =
    "-" + ConvertSeconds(duration - progress);

  // back‑buffer swap
  setTimeout(() => {
    document.getElementById("albumArtBack").src = albumArt;
    document.getElementById("backgroundImageBack").src = albumArt;
  }, 1000);
}

function UpdateTextLabel(el, text) {
  if (el.innerText !== text) {
    el.classList.add("text-fade");
    setTimeout(() => {
      el.innerText = text;
      el.classList.add("text-show");
    }, 500);
  }
}

function UpdateAlbumArt(el, src) {
  if (el.src !== src) {
    el.classList.add("text-fade");
    setTimeout(() => {
      el.src = src;
      el.classList.add("text-show");
    }, 500);
  }
}

function ConvertSeconds(time) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// Visibility toggling via class
function SetVisibility(isVisible, updateState = true) {
  if (isVisible) {
    mainContainer.classList.add("visible");
  } else {
    mainContainer.classList.remove("visible");
  }
  if (updateState) currentState = isVisible;
}

///////////////////////
// INITIALIZE WIDGET //
///////////////////////

// apply slide direction class
mainContainer.classList.add(`slide-from-${slideFrom}`);

// optional hide album art
if (hideAlbumArt) {
  document.getElementById("albumArtBox").style.display = "none";
  document.getElementById("songInfoBox").style.width = "calc(100% - 20px)";
}

// kick off
RefreshAccessToken();
GetCurrentlyPlaying();
