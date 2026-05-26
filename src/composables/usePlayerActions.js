// Lightweight singleton that exposes the player's play/stop actions to any
// component that needs them (e.g. PlaylistColumn). ScorePlayer registers the
// concrete handlers at mount time; everywhere else just imports the composable
// and calls them.

const handlers = {
  play: null,
  stop: null,
}

export function usePlayerActions() {
  function register({ play, stop } = {}) {
    if (typeof play === 'function') handlers.play = play
    if (typeof stop === 'function') handlers.stop = stop
  }
  function unregister() {
    handlers.play = null
    handlers.stop = null
  }
  function play() {
    handlers.play?.()
  }
  function stop() {
    handlers.stop?.()
  }
  return { register, unregister, play, stop }
}
