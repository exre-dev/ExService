const imagePaths = Object.keys(
  import.meta.glob('/public/images/heros/join/*/*.{avif,gif,jpeg,jpg,png,webp}'),
)

export function getJoinHeroImages(id: string): string[] {
  const prefix = `/public/images/heros/join/${id}/`
  return imagePaths
    .filter((path) => path.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right))
    .map((path) => path.slice('/public'.length))
}
