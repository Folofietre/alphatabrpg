import { ref } from 'vue'

const isPlaying = ref(false)

export function usePlaybackLock() {
  function setPlaying(value) {
    isPlaying.value = !!value
  }
  return { isPlaying, setPlaying }
}
