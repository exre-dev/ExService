/** Native import failures can outlive application Promise caches. Keep the current URL. */
export function reloadPage() {
  window.location.reload()
}
